import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

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

export async function POST(request, { params }) {
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

    const { id } = params;
    const body = await request.json();
    const action = String(body.action || '').trim();

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { data: restaurant, error: restaurantError } = order.restaurant_id
      ? await admin.from('restaurants').select('*').eq('id', order.restaurant_id).maybeSingle()
      : { data: null, error: null };

    if (restaurantError) throw restaurantError;

    let patch = null;

    if (action in allowedRestaurantTransitions) {
      if (!isRestaurantManager(user, profile, restaurant)) {
        return NextResponse.json({ error: 'Only this restaurant or an admin can update this order.' }, { status: 403 });
      }

      const transition = allowedRestaurantTransitions[action];
      if (!transition.from.includes(order.status)) {
        return NextResponse.json({ error: `Cannot ${action} an order with status ${order.status}.` }, { status: 400 });
      }

      patch = transition.patch(body);
    } else if (action === 'assign_driver') {
      if (!isRestaurantManager(user, profile, restaurant)) {
        return NextResponse.json({ error: 'Only this restaurant or an admin can assign a driver.' }, { status: 403 });
      }

      if (order.status !== 'ready_for_pickup') {
        return NextResponse.json({ error: 'Drivers can only be assigned after the order is ready for pickup.' }, { status: 400 });
      }

      const driverEmail = String(body.driver_email || '').trim().toLowerCase();
      if (!driverEmail) {
        return NextResponse.json({ error: 'Driver email is required.' }, { status: 400 });
      }

      const { data: driver, error: driverError } = await admin
        .from('profiles')
        .select('*')
        .eq('email', driverEmail)
        .maybeSingle();

      if (driverError) throw driverError;
      if (!driver || driver.role !== 'driver') {
        return NextResponse.json({ error: 'Driver not found.' }, { status: 404 });
      }
      if (driver.driver_approval_status && driver.driver_approval_status !== 'approved') {
        return NextResponse.json({ error: 'Driver is not approved yet.' }, { status: 400 });
      }

      patch = { driver_email: driver.email, driver_name: driver.full_name };
    } else if (action === 'driver_accept') {
      if (profile.role !== 'driver') {
        return NextResponse.json({ error: 'Only drivers can accept deliveries.' }, { status: 403 });
      }
      if (profile.driver_approval_status && profile.driver_approval_status !== 'approved') {
        return NextResponse.json({ error: 'Your driver account is still waiting for approval.' }, { status: 403 });
      }
      if (profile.driver_status !== 'online') {
        return NextResponse.json({ error: 'Go online before accepting a delivery.' }, { status: 400 });
      }
      if (order.status !== 'ready_for_pickup' || order.driver_email) {
        return NextResponse.json({ error: 'This delivery is no longer available.' }, { status: 400 });
      }

      patch = { driver_email: user.email, driver_name: profile.full_name };
    } else if (action === 'picked_up' || action === 'on_the_way' || action === 'delivered') {
      if (profile.role !== 'driver' && profile.role !== 'admin') {
        return NextResponse.json({ error: 'Only the assigned driver or an admin can update delivery status.' }, { status: 403 });
      }
      if (profile.role !== 'admin' && order.driver_email !== user.email) {
        return NextResponse.json({ error: 'You are not assigned to this delivery.' }, { status: 403 });
      }

      const expectedPrevious = {
        picked_up: 'ready_for_pickup',
        on_the_way: 'picked_up',
        delivered: 'on_the_way',
      };

      if (order.status !== expectedPrevious[action]) {
        return NextResponse.json({ error: `Cannot mark ${action} from ${order.status}.` }, { status: 400 });
      }

      patch = { status: action };
      if (action === 'picked_up') patch.picked_up_at = new Date().toISOString();
      if (action === 'delivered') patch.delivered_at = new Date().toISOString();
    } else {
      return NextResponse.json({ error: 'Unsupported order action.' }, { status: 400 });
    }

    const { data: updatedOrder, error: updateError } = await admin
      .from('orders')
      .update({ ...patch, updated_date: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

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
    return NextResponse.json({ error: error.message || 'Failed to update order' }, { status: 500 });
  }
}
