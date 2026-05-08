import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { apiError, readJsonBody, validationError } from '@/lib/api/responses';
import { orderActionRequestSchema, orderIdParamSchema } from '@/lib/orders/validation';

const getBearerToken = (request) => {
  const authHeader = request.headers.get('authorization') || '';
  const [, token] = authHeader.split(' ');
  return token || null;
};

const activeStatuses = ['ready_for_pickup', 'picked_up', 'on_the_way'];

const allowedRestaurantTransitions = {
  accept: { from: ['pending'], patch: () => ({ status: 'accepted', accepted_at: new Date().toISOString() }) },
  reject: {
    from: ['pending'],
    patch: ({ reason }) => ({
      status: 'rejected',
      rejection_reason: reason?.trim() || 'Restaurant unable to fulfill',
    }),
  },
  preparing: { from: ['accepted'], patch: () => ({ status: 'preparing' }) },
  ready_for_pickup: { from: ['preparing'], patch: () => ({ status: 'ready_for_pickup' }) },
};

const isRestaurantManager = (user, profile, restaurant) =>
  profile?.role === 'admin'
  || (
    restaurant
    && profile?.role === 'restaurant'
    && (restaurant.owner_email === user.email || restaurant.id === profile?.restaurant_id)
  );

const settleCashPaymentOnDelivery = (order, patch) => {
  if (order.payment_method !== 'cash') return patch;

  return {
    ...patch,
    payment_status: 'paid',
    cash_collected_at: new Date().toISOString(),
    payment_confirmed_at: new Date().toISOString(),
  };
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

export async function POST(request, { params }) {
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

    const { id } = params;
    const parsedId = orderIdParamSchema.safeParse(id);
    if (!parsedId.success) {
      return apiError('VALIDATION_ERROR', 'Invalid order id.', {
        status: 400,
        details: [{ path: 'id', code: 'invalid_string', message: 'Order id must be a UUID.' }],
      });
    }

    const json = await readJsonBody(request);
    if (!json.ok) return json.response;

    const parsedBody = orderActionRequestSchema.safeParse(json.data);
    if (!parsedBody.success) return validationError(parsedBody.error);

    const body = parsedBody.data;
    const action = body.action;

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return apiError('PROFILE_NOT_FOUND', 'Profile not found', { status: 404 });
    }
    const actorRole = profile.role || 'customer';

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) {
      return apiError('ORDER_NOT_FOUND', 'Order not found', { status: 404 });
    }

    const { data: restaurant, error: restaurantError } = order.restaurant_id
      ? await admin.from('restaurants').select('*').eq('id', order.restaurant_id).maybeSingle()
      : { data: null, error: null };

    if (restaurantError) throw restaurantError;

    let patch = null;

    if (action in allowedRestaurantTransitions) {
      if (!isRestaurantManager(user, profile, restaurant)) {
        return apiError('ORDER_FORBIDDEN', 'Only this restaurant or an admin can update this order.', { status: 403 });
      }

      const transition = allowedRestaurantTransitions[action];
      if (!transition.from.includes(order.status)) {
        return apiError('INVALID_STATUS_TRANSITION', `Cannot ${action} an order with status ${order.status}.`, { status: 400 });
      }

      patch = transition.patch(body);
      if (action === 'preparing' && body.estimated_ready_minutes !== undefined) {
        const minutes = body.estimated_ready_minutes;
        patch.estimated_ready_at = new Date(Date.now() + minutes * 60000).toISOString();
      }
    } else if (action === 'assign_driver') {
      if (!isRestaurantManager(user, profile, restaurant)) {
        return apiError('ORDER_FORBIDDEN', 'Only this restaurant or an admin can assign a driver.', { status: 403 });
      }

      if (order.status !== 'ready_for_pickup') {
        return apiError('INVALID_STATUS_TRANSITION', 'Drivers can only be assigned after the order is ready for pickup.', { status: 400 });
      }

      const driverEmail = body.driver_email;

      const { data: driver, error: driverError } = await admin
        .from('profiles')
        .select('*')
        .eq('email', driverEmail)
        .maybeSingle();

      if (driverError) throw driverError;
      if (!driver || driver.role !== 'driver') {
        return apiError('DRIVER_NOT_FOUND', 'Driver not found.', { status: 404 });
      }
      if (driver.driver_approval_status && driver.driver_approval_status !== 'approved') {
        return apiError('DRIVER_NOT_APPROVED', 'Driver is not approved yet.', { status: 400 });
      }
      if (driver.driver_status !== 'online') {
        return apiError('DRIVER_NOT_ONLINE', 'Driver must be online before assignment.', { status: 400 });
      }

      patch = { driver_email: driver.email, driver_name: driver.full_name };
    } else if (action === 'customer_cancel') {
      if (profile.role !== 'admin' && order.customer_email !== user.email) {
        return apiError('ORDER_FORBIDDEN', 'Only this customer or an admin can cancel this order.', { status: 403 });
      }
      if (!['accepted', 'pending'].includes(order.status)) {
        return apiError('INVALID_STATUS_TRANSITION', 'This order can no longer be cancelled.', { status: 400 });
      }

      patch = {
        status: 'cancelled',
        rejection_reason: String(body.reason || 'Cancelled by customer').trim(),
      };
      if (order.payment_status === 'paid' && order.payment_method !== 'cash') {
        patch.payment_status = 'refunded';
      } else if (order.payment_method === 'cash') {
        patch.payment_status = 'cancelled';
      } else if (order.payment_status === 'pending') {
        patch.payment_status = 'failed';
      }
    } else if (action === 'driver_accept') {
      if (profile.role !== 'driver') {
        return apiError('ORDER_FORBIDDEN', 'Only drivers can accept deliveries.', { status: 403 });
      }
      if (profile.driver_approval_status && profile.driver_approval_status !== 'approved') {
        return apiError('DRIVER_NOT_APPROVED', 'Your driver account is still waiting for approval.', { status: 403 });
      }
      if (profile.driver_status !== 'online') {
        return apiError('DRIVER_NOT_ONLINE', 'Go online before accepting a delivery.', { status: 400 });
      }
      if (order.status !== 'ready_for_pickup' || order.driver_email) {
        return apiError('DELIVERY_UNAVAILABLE', 'This delivery is no longer available.', { status: 400 });
      }

      patch = { driver_email: user.email, driver_name: profile.full_name };
    } else if (action === 'picked_up' || action === 'on_the_way' || action === 'delivered') {
      if (profile.role !== 'driver' && profile.role !== 'admin') {
        return apiError('ORDER_FORBIDDEN', 'Only the assigned driver or an admin can update delivery status.', { status: 403 });
      }
      if (profile.role !== 'admin' && order.driver_email !== user.email) {
        return apiError('ORDER_FORBIDDEN', 'You are not assigned to this delivery.', { status: 403 });
      }

      const expectedPrevious = {
        picked_up: 'ready_for_pickup',
        on_the_way: 'picked_up',
        delivered: 'on_the_way',
      };

      if (order.status !== expectedPrevious[action]) {
        return apiError('INVALID_STATUS_TRANSITION', `Cannot mark ${action} from ${order.status}.`, { status: 400 });
      }

      patch = { status: action };
      if (action === 'picked_up') patch.picked_up_at = new Date().toISOString();
      if (action === 'delivered') {
        patch.delivered_at = new Date().toISOString();
        patch = settleCashPaymentOnDelivery(order, patch);
      }
    } else {
      return apiError('UNSUPPORTED_ORDER_ACTION', 'Unsupported order action.', { status: 400 });
    }

    let updateQuery = admin
      .from('orders')
      .update({ ...patch, updated_date: new Date().toISOString() })
      .eq('id', id)
      .eq('status', order.status);

    updateQuery = order.driver_email
      ? updateQuery.eq('driver_email', order.driver_email)
      : updateQuery.is('driver_email', null);

    const { data: updatedOrder, error: updateError } = await updateQuery.select().single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return apiError('ORDER_UPDATE_CONFLICT', 'This order changed before your update. Please refresh and try again.', { status: 409 });
      }
      throw updateError;
    }

    writeOrderEvent(
      admin,
      id,
      { email: user.email, role: actorRole },
      action,
      order.status,
      updatedOrder.status,
      body.reason || null
    ).catch(() => {});

    if (action === 'driver_accept') {
      await admin
        .from('profiles')
        .update({ driver_status: 'on_delivery', updated_date: new Date().toISOString() })
        .eq('id', user.id);
    }

    if (action === 'delivered' && order.driver_email) {
      const { data: activeOrders, error: activeError } = await admin
        .from('orders')
        .select('id')
        .eq('driver_email', order.driver_email)
        .in('status', activeStatuses);

      if (activeError) throw activeError;

      const { data: driverProfile, error: driverProfileError } = await admin
        .from('profiles')
        .select('driver_total_deliveries, driver_total_earnings')
        .eq('email', order.driver_email)
        .maybeSingle();

      if (driverProfileError) throw driverProfileError;

      await admin
        .from('profiles')
        .update({
          driver_status: activeOrders?.length ? 'on_delivery' : 'online',
          driver_total_deliveries: (driverProfile?.driver_total_deliveries || 0) + 1,
          driver_total_earnings: (driverProfile?.driver_total_earnings || 0) + (order.delivery_fee || 0),
          updated_date: new Date().toISOString(),
        })
        .eq('email', order.driver_email);
    }

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    console.error('Order action failed:', error);
    return apiError('ORDER_ACTION_FAILED', 'Failed to update order', { status: 500 });
  }
}
