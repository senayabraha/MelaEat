import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { apiError, readJsonBody, validationError } from '@/lib/api/responses';
import { createOrderRequestSchema } from '@/lib/orders/validation';

const getBearerToken = (request) => {
  const authHeader = request.headers.get('authorization') || '';
  const [, token] = authHeader.split(' ');
  return token || null;
};

const asNumber = (value) => Number(value || 0);

const isRestaurantOpenNow = (restaurant) => {
  if (!restaurant) return false;
  if (restaurant.is_open_manual === false) return false;
  const hours = restaurant.operating_hours;
  if (!hours || typeof hours !== 'object') return true;

  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const now = new Date();
  const today = hours[dayKeys[now.getDay()]];
  if (!today || today.closed) return false;

  const open = today.open || '00:00';
  const close = today.close || '23:59';
  const [openHours, openMinutes] = open.split(':').map(Number);
  const [closeHours, closeMinutes] = close.split(':').map(Number);
  const openAt = openHours * 60 + openMinutes;
  const closeAt = closeHours * 60 + closeMinutes;
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  if (!Number.isFinite(openAt) || !Number.isFinite(closeAt)) return true;
  if (closeAt < openAt) return minutesNow >= openAt || minutesNow <= closeAt;
  return minutesNow >= openAt && minutesNow <= closeAt;
};

const getChoicePrice = (menuItem, selectedOption) => {
  const groups = menuItem.options || [];
  const group = groups.find((g) => g.group_name === selectedOption.group_name);
  const choice = group?.choices?.find((c) => c.name === selectedOption.choice_name);
  return asNumber(choice?.price_delta);
};

const buildOrderItems = (cartItems, menuItems) => {
  const byId = new Map(menuItems.map((item) => [item.id, item]));

  return cartItems.map((cartItem) => {
    const menuItem = byId.get(cartItem.menu_item_id);
    if (!menuItem) throw new Error(`Menu item ${cartItem.menu_item_id} is no longer available.`);
    if (menuItem.in_stock === false) throw new Error(`${menuItem.name} is out of stock.`);

    const selectedOptions = (cartItem.selected_options || []).map((option) => ({
      group_name: option.group_name,
      choice_name: option.choice_name,
      price_delta: getChoicePrice(menuItem, option),
    }));
    const optionsTotal = selectedOptions.reduce((sum, option) => sum + asNumber(option.price_delta), 0);
    const unitPrice = asNumber(menuItem.price) + optionsTotal;
    const quantity = Math.max(1, Math.floor(asNumber(cartItem.quantity)));

    return {
      menu_item_id: menuItem.id,
      name: menuItem.name,
      quantity,
      unit_price: unitPrice,
      selected_options: selectedOptions,
      line_total: unitPrice * quantity,
      notes: String(cartItem.notes || '').slice(0, 500),
    };
  });
};

const promoRpcErrors = {
  INVALID_PROMO_CODE: { status: 400, message: 'Invalid promo code.' },
  PROMO_NOT_APPLICABLE: { status: 400, message: 'This promo is not valid for this restaurant.' },
  PROMO_NOT_STARTED: { status: 400, message: 'This promo is not active yet.' },
  PROMO_EXPIRED: { status: 400, message: 'This promo has expired.' },
  PROMO_USAGE_LIMIT_REACHED: { status: 409, message: 'This promo has reached its usage limit.' },
  PROMO_MIN_ORDER_NOT_MET: { status: 400, message: 'Minimum order required for this promo has not been met.' },
};

const mapCreateOrderRpcError = (error) => {
  const raw = `${error?.message || ''} ${error?.details || ''}`;
  const code = Object.keys(promoRpcErrors).find((candidate) => raw.includes(candidate));

  if (!code) return null;

  const mapped = promoRpcErrors[code];
  return apiError(code, mapped.message, { status: mapped.status });
};

export async function POST(request) {
  try {
    const admin = getSupabaseAdmin();
    const token = getBearerToken(request);
    if (!token) {
      return apiError('AUTH_REQUIRED', 'Authentication required', { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);

    if (userError || !user) {
      return apiError('INVALID_SESSION', 'Invalid session', { status: 401 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return apiError('PROFILE_NOT_FOUND', 'Profile not found', { status: 404 });
    }

    const json = await readJsonBody(request);
    if (!json.ok) return json.response;

    const parsed = createOrderRequestSchema.safeParse(json.data);
    if (!parsed.success) return validationError(parsed.error);

    const body = parsed.data;
    const restaurantId = body.restaurant_id;
    const cartItems = body.items;

    const { data: restaurant, error: restaurantError } = await admin
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .maybeSingle();

    if (restaurantError) throw restaurantError;
    if (!restaurant || restaurant.status !== 'approved') {
      return apiError('RESTAURANT_UNAVAILABLE', 'This restaurant is not available.', { status: 400 });
    }
    if (restaurant.is_open_manual === false) {
      return apiError('RESTAURANT_PAUSED', 'This restaurant is currently paused.', { status: 400 });
    }
    if (!body.is_scheduled && !isRestaurantOpenNow(restaurant)) {
      return apiError('RESTAURANT_CLOSED', 'This restaurant is closed right now.', { status: 400 });
    }

    const menuItemIds = [...new Set(cartItems.map((item) => item.menu_item_id))];
    const { data: menuItems, error: menuError } = await admin
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('id', menuItemIds);

    if (menuError) throw menuError;

    let items = [];
    try {
      items = buildOrderItems(cartItems, menuItems || []);
    } catch (error) {
      return apiError('INVALID_ORDER_ITEMS', error.message || 'Invalid order items.', { status: 400 });
    }

    const subtotal = items.reduce((sum, item) => sum + asNumber(item.line_total), 0);
    if (restaurant.minimum_order && subtotal < restaurant.minimum_order) {
      return apiError('MINIMUM_ORDER_NOT_MET', `Minimum order is ${restaurant.minimum_order} ETB.`, { status: 400 });
    }

    const paymentMethod = body.payment_method;
    const isScheduled = body.is_scheduled;
    const scheduledFor = isScheduled ? new Date(body.scheduled_for) : null;
    if (isScheduled) {
      if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
        return apiError('INVALID_SCHEDULED_TIME', 'A valid scheduled delivery time is required.', { status: 400 });
      }
      const minimumLeadTime = Date.now() + 30 * 60 * 1000;
      if (scheduledFor.getTime() < minimumLeadTime) {
        return apiError('INVALID_SCHEDULED_TIME', 'Scheduled orders must be at least 30 minutes from now.', { status: 400 });
      }
    }

    const orderPayload = {
      customer_phone: body.customer_phone,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      items,
      subtotal,
      delivery_fee: asNumber(restaurant.delivery_fee),
      promo_code: body.promo_code || null,
      payment_method: paymentMethod,
      delivery_lat: body.delivery_lat,
      delivery_lng: body.delivery_lng,
      delivery_address_text: body.delivery_address_text,
      delivery_notes: body.delivery_notes,
      is_scheduled: isScheduled,
      scheduled_for: isScheduled ? scheduledFor.toISOString() : null,
      idempotency_key: body.idempotency_key || null,
    };

    if (
      !orderPayload.customer_phone
      || orderPayload.delivery_lat === null
      || orderPayload.delivery_lat === undefined
      || orderPayload.delivery_lng === null
      || orderPayload.delivery_lng === undefined
    ) {
      return apiError('DELIVERY_DETAILS_REQUIRED', 'Phone and delivery location are required.', { status: 400 });
    }

    const { data: order, error: orderError } = await admin.rpc('create_order_atomic', {
      p_customer_id: user.id,
      p_customer_email: user.email,
      p_customer_name: profile.full_name || user.email,
      p_actor_role: profile.role || 'customer',
      p_order: orderPayload,
    });

    if (orderError) {
      const mappedResponse = mapCreateOrderRpcError(orderError);
      if (mappedResponse) return mappedResponse;
      throw orderError;
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Order creation failed:', error);
    return apiError('ORDER_CREATE_FAILED', 'Failed to place order', { status: 500 });
  }
}
