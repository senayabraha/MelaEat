import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const getBearerToken = (request) => {
  const authHeader = request.headers.get('authorization') || '';
  const [, token] = authHeader.split(' ');
  return token || null;
};

const generateOrderNumber = () => {
  const t = Date.now().toString().slice(-6);
  const r = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `ME-${t}${r}`;
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

const applyPromotion = (promotion, subtotal, deliveryFee) => {
  if (!promotion) return { discount: 0, delivery_fee: deliveryFee, promo_code: null };
  if (promotion.min_order && subtotal < promotion.min_order) {
    throw new Error(`Minimum order ${promotion.min_order} ETB required for this promo.`);
  }

  if (promotion.discount_type === 'free_delivery') {
    return { discount: 0, delivery_fee: 0, promo_code: promotion.code };
  }

  const discount = promotion.discount_type === 'percentage'
    ? Math.round((subtotal * asNumber(promotion.discount_value)) / 100)
    : asNumber(promotion.discount_value);

  return { discount: Math.min(discount, subtotal), delivery_fee: deliveryFee, promo_code: promotion.code };
};

const writeOrderEvent = async (admin, orderId, actor, action, fromStatus, toStatus, note) => {
  await admin.from('order_status_events').insert({
    order_id: orderId,
    actor_email: actor.email,
    actor_role: actor.role,
    action,
    from_status: fromStatus,
    to_status: toStatus,
    note,
  }).throwOnError();
};

export async function POST(request) {
  try {
    const admin = getSupabaseAdmin();
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();
    const restaurantId = String(body.restaurant_id || '').trim();
    const cartItems = Array.isArray(body.items) ? body.items : [];
    if (!restaurantId || cartItems.length === 0) {
      return NextResponse.json({ error: 'Restaurant and items are required.' }, { status: 400 });
    }

    const { data: restaurant, error: restaurantError } = await admin
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .maybeSingle();

    if (restaurantError) throw restaurantError;
    if (!restaurant || restaurant.status !== 'approved') {
      return NextResponse.json({ error: 'This restaurant is not available.' }, { status: 400 });
    }
    if (restaurant.is_open_manual === false) {
      return NextResponse.json({ error: 'This restaurant is currently paused.' }, { status: 400 });
    }
    if (!body.is_scheduled && !isRestaurantOpenNow(restaurant)) {
      return NextResponse.json({ error: 'This restaurant is closed right now.' }, { status: 400 });
    }

    const menuItemIds = [...new Set(cartItems.map((item) => item.menu_item_id).filter(Boolean))];
    const { data: menuItems, error: menuError } = await admin
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('id', menuItemIds);

    if (menuError) throw menuError;

    const items = buildOrderItems(cartItems, menuItems || []);
    const subtotal = items.reduce((sum, item) => sum + asNumber(item.line_total), 0);
    if (restaurant.minimum_order && subtotal < restaurant.minimum_order) {
      return NextResponse.json({ error: `Minimum order is ${restaurant.minimum_order} ETB.` }, { status: 400 });
    }

    let promotion = null;
    const promoCode = String(body.promo_code || '').trim().toUpperCase();
    if (promoCode) {
      const { data: promo, error: promoError } = await admin
        .from('promotions')
        .select('*')
        .eq('code', promoCode)
        .eq('is_active', true)
        .maybeSingle();
      if (promoError) throw promoError;
      if (!promo) return NextResponse.json({ error: 'Invalid promo code.' }, { status: 400 });
      if (promo.restaurant_id && promo.restaurant_id !== restaurantId) {
        return NextResponse.json({ error: 'This promo is not valid for this restaurant.' }, { status: 400 });
      }
      promotion = promo;
    }

    const paymentMethod = ['cash', 'telebirr', 'card'].includes(body.payment_method) ? body.payment_method : 'cash';
    const isScheduled = Boolean(body.is_scheduled);
    const scheduledFor = isScheduled ? new Date(body.scheduled_for) : null;
    if (isScheduled) {
      if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
        return NextResponse.json({ error: 'A valid scheduled delivery time is required.' }, { status: 400 });
      }
      const minimumLeadTime = Date.now() + 30 * 60 * 1000;
      if (scheduledFor.getTime() < minimumLeadTime) {
        return NextResponse.json({ error: 'Scheduled orders must be at least 30 minutes from now.' }, { status: 400 });
      }
    }
    const priced = applyPromotion(promotion, subtotal, asNumber(restaurant.delivery_fee));
    const total = Math.max(0, subtotal + priced.delivery_fee - priced.discount);
    const now = new Date().toISOString();

    const orderPayload = {
      order_number: generateOrderNumber(),
      customer_email: user.email,
      customer_name: profile.full_name || user.email,
      customer_phone: String(body.customer_phone || profile.phone || '').trim(),
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.name,
      items,
      subtotal,
      delivery_fee: priced.delivery_fee,
      discount: priced.discount,
      total,
      promo_code: priced.promo_code,
      payment_method: paymentMethod,
      payment_status: paymentMethod === 'cash' ? 'cash_on_delivery' : 'pending',
      delivery_lat: body.delivery_lat,
      delivery_lng: body.delivery_lng,
      delivery_address_text: String(body.delivery_address_text || '').trim(),
      delivery_notes: String(body.delivery_notes || '').slice(0, 500),
      is_scheduled: isScheduled,
      scheduled_for: isScheduled ? scheduledFor.toISOString() : null,
      status: 'accepted',
      accepted_at: now,
      updated_date: now,
    };

    if (!orderPayload.customer_phone || !orderPayload.delivery_lat || !orderPayload.delivery_lng) {
      return NextResponse.json({ error: 'Phone and delivery location are required.' }, { status: 400 });
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert(orderPayload)
      .select()
      .single();

    if (orderError) throw orderError;

    if (promotion) {
      await admin
        .from('promotions')
        .update({ times_used: asNumber(promotion.times_used) + 1, updated_date: now })
        .eq('id', promotion.id);
    }

    await admin
      .from('profiles')
      .update({
        phone: orderPayload.customer_phone,
        default_lat: orderPayload.delivery_lat,
        default_lng: orderPayload.delivery_lng,
        default_address_text: orderPayload.delivery_address_text,
        updated_date: now,
      })
      .eq('id', user.id);

    writeOrderEvent(admin, order.id, { email: user.email, role: profile.role }, 'created_auto_accepted', null, 'accepted', 'Order created and accepted automatically').catch(() => {});

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Order creation failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to place order' }, { status: 500 });
  }
}
