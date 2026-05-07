import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const getBearerToken = (request) => {
  const authHeader = request.headers.get('authorization') || '';
  const [, token] = authHeader.split(' ');
  return token || null;
};

const averageFromRatings = (rows, field) => {
  const values = rows
    .map((row) => Number(row[field]))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (values.length === 0) {
    return { average: 0, total: 0 };
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    average: Number((total / values.length).toFixed(2)),
    total: values.length,
  };
};

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
    const {
      customer_rating_restaurant,
      customer_rating_driver,
      customer_review,
    } = await request.json();

    const restaurantRating = Number(customer_rating_restaurant);
    const driverRating = customer_rating_driver === null || customer_rating_driver === undefined
      ? null
      : Number(customer_rating_driver);

    if (!Number.isFinite(restaurantRating) || restaurantRating < 1 || restaurantRating > 5) {
      return NextResponse.json({ error: 'Restaurant rating must be between 1 and 5.' }, { status: 400 });
    }

    if (driverRating !== null && (!Number.isFinite(driverRating) || driverRating < 1 || driverRating > 5)) {
      return NextResponse.json({ error: 'Driver rating must be between 1 and 5.' }, { status: 400 });
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

    if (order.customer_email !== user.email) {
      return NextResponse.json({ error: 'You can only rate your own orders.' }, { status: 403 });
    }

    if (order.status !== 'delivered') {
      return NextResponse.json({ error: 'You can only rate delivered orders.' }, { status: 400 });
    }

    const { error: updateOrderError } = await admin
      .from('orders')
      .update({
        customer_rating_restaurant: restaurantRating,
        customer_rating_driver: order.driver_email ? driverRating : null,
        customer_review: customer_review?.trim() || null,
        updated_date: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateOrderError) throw updateOrderError;

    if (order.restaurant_id) {
      const { data: restaurantRatings, error: restaurantRatingsError } = await admin
        .from('orders')
        .select('customer_rating_restaurant')
        .eq('restaurant_id', order.restaurant_id)
        .not('customer_rating_restaurant', 'is', null);

      if (restaurantRatingsError) throw restaurantRatingsError;

      const { average, total } = averageFromRatings(restaurantRatings || [], 'customer_rating_restaurant');

      const { error: restaurantUpdateError } = await admin
        .from('restaurants')
        .update({
          rating: average,
          total_ratings: total,
          updated_date: new Date().toISOString(),
        })
        .eq('id', order.restaurant_id);

      if (restaurantUpdateError) throw restaurantUpdateError;
    }

    if (order.driver_email) {
      const { data: driverRatings, error: driverRatingsError } = await admin
        .from('orders')
        .select('customer_rating_driver')
        .eq('driver_email', order.driver_email)
        .not('customer_rating_driver', 'is', null);

      if (driverRatingsError) throw driverRatingsError;

      const { average } = averageFromRatings(driverRatings || [], 'customer_rating_driver');

      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update({
          driver_rating: average || 5,
          updated_date: new Date().toISOString(),
        })
        .eq('email', order.driver_email);

      if (profileUpdateError) throw profileUpdateError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Order rating failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to save rating' }, { status: 500 });
  }
}
