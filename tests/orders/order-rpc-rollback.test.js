import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

const enabled = process.env.RUN_SUPABASE_ORDER_RPC_TESTS === '1' || process.env.RUN_SUPABASE_CONCURRENCY_TESTS === '1';

test('create_order_atomic rolls back promo usage when a later order insert fails', {
  skip: enabled ? false : 'Set RUN_SUPABASE_ORDER_RPC_TESTS=1 with Supabase service-role env vars to run.',
}, async (t) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    t.skip('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    return;
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const runId = randomUUID();
  const promoCode = `ROLL_${runId.slice(0, 8).toUpperCase()}`;
  let restaurantId = null;
  let promoId = null;

  try {
    const { data: restaurant, error: restaurantError } = await admin
      .from('restaurants')
      .insert({
        name: `Rollback Test ${runId}`,
        city: 'Test',
        status: 'approved',
        delivery_fee: 10,
        minimum_order: 0,
      })
      .select()
      .single();

    if (restaurantError) throw restaurantError;
    restaurantId = restaurant.id;

    const { data: promo, error: promoError } = await admin
      .from('promotions')
      .insert({
        code: promoCode,
        restaurant_id: restaurantId,
        title: 'Rollback test promo',
        discount_type: 'fixed',
        discount_value: 10,
        usage_limit: 1,
        times_used: 0,
        is_active: true,
      })
      .select()
      .single();

    if (promoError) throw promoError;
    promoId = promo.id;

    const { error } = await admin.rpc('create_order_atomic', {
      p_customer_id: randomUUID(),
      p_customer_email: `rollback-${runId}@example.com`,
      p_customer_name: 'Rollback Test',
      p_actor_role: 'customer',
      p_order: {
        restaurant_id: restaurantId,
        restaurant_name: restaurant.name,
        customer_phone: '+251911234567',
        items: [{ menu_item_id: randomUUID(), name: 'Test item', quantity: 1, unit_price: 100, line_total: 100 }],
        subtotal: 100,
        delivery_fee: 10,
        promo_code: promoCode,
        payment_method: 'bitcoin',
        delivery_lat: 0,
        delivery_lng: 0,
        delivery_address_text: 'Rollback test address',
        delivery_notes: '',
        is_scheduled: false,
        scheduled_for: null,
        idempotency_key: randomUUID(),
      },
    });

    assert.ok(error, 'expected invalid payment_method to fail order insert');

    const { data: updatedPromo, error: updatedPromoError } = await admin
      .from('promotions')
      .select('times_used')
      .eq('id', promoId)
      .single();

    if (updatedPromoError) throw updatedPromoError;
    assert.equal(updatedPromo.times_used, 0);

    const { data: orders, error: ordersError } = await admin
      .from('orders')
      .select('id')
      .eq('restaurant_id', restaurantId);

    if (ordersError) throw ordersError;
    assert.equal(orders.length, 0);
  } finally {
    if (restaurantId) {
      await admin.from('orders').delete().eq('restaurant_id', restaurantId);
    }

    if (promoId) {
      await admin.from('promotions').delete().eq('id', promoId);
    }

    if (restaurantId) {
      await admin.from('restaurants').delete().eq('id', restaurantId);
    }
  }
});
