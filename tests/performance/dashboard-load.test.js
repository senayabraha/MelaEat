import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { createClient } from '@supabase/supabase-js';

const enabled = process.env.RUN_SUPABASE_DASHBOARD_LOAD_TESTS === '1';
const iterations = Number.parseInt(process.env.LOAD_ITERATIONS || '5', 10);
const p95ThresholdMs = Number.parseFloat(process.env.LOAD_P95_MS || '1500');

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
};

const measure = async (name, fn) => {
  const durations = [];

  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    const { error } = await fn();
    const duration = performance.now() - started;

    if (error) throw error;
    durations.push(duration);
  }

  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);

  console.log(`${name}: p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms runs=${durations.length}`);

  assert.ok(
    p95 <= p95ThresholdMs,
    `${name} p95 ${p95.toFixed(1)}ms exceeded ${p95ThresholdMs}ms threshold`
  );
};

const firstValue = async (query, column) => {
  const { data, error } = await query.not(column, 'is', null).limit(1).maybeSingle();

  if (error) throw error;
  return data?.[column] ?? null;
};

test('dashboard Supabase queries stay within p95 budget', {
  skip: enabled ? false : 'Set RUN_SUPABASE_DASHBOARD_LOAD_TESTS=1 with Supabase service-role env vars to run.',
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

  const restaurantId =
    process.env.LOAD_RESTAURANT_ID ||
    (await firstValue(admin.from('orders').select('restaurant_id'), 'restaurant_id'));
  const driverEmail =
    process.env.LOAD_DRIVER_EMAIL ||
    (await firstValue(admin.from('orders').select('driver_email'), 'driver_email'));

  await measure('admin recent orders', () =>
    admin
      .from('orders')
      .select('id,status,created_date,total')
      .order('created_date', { ascending: false })
      .limit(200)
  );

  if (restaurantId) {
    await measure('restaurant orders', () =>
      admin
        .from('orders')
        .select('id,status,created_date,total,restaurant_id')
        .eq('restaurant_id', restaurantId)
        .order('created_date', { ascending: false })
        .limit(200)
    );
  } else {
    console.log('restaurant orders: skipped; no restaurant_id found');
  }

  if (driverEmail) {
    await measure('driver active queue', () =>
      admin
        .from('orders')
        .select('id,status,updated_date,driver_email')
        .eq('driver_email', driverEmail)
        .in('status', ['ready_for_pickup', 'picked_up', 'on_the_way'])
        .order('updated_date', { ascending: false })
        .limit(20)
    );
  } else {
    console.log('driver active queue: skipped; no driver_email found');
  }

  await measure('driver available pickups', () =>
    admin
      .from('orders')
      .select('id,status,created_date,driver_email')
      .eq('status', 'ready_for_pickup')
      .is('driver_email', null)
      .order('created_date', { ascending: false })
      .limit(50)
  );
});
