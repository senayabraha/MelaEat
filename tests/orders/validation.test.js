import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createOrderRequestSchema,
  orderActionRequestSchema,
  orderIdParamSchema,
} from '../../src/lib/orders/validation.js';

const restaurantId = '11111111-1111-4111-8111-111111111111';
const menuItemId = '22222222-2222-4222-8222-222222222222';
const orderId = '33333333-3333-4333-8333-333333333333';

const createOrderPayload = (overrides = {}) => ({
  restaurant_id: restaurantId,
  customer_phone: '+251911234567',
  items: [
    {
      menu_item_id: menuItemId,
      quantity: 2,
      selected_options: [{ group_name: 'Size', choice_name: 'Large' }],
      notes: 'No onions',
    },
  ],
  promo_code: ' lunch-10 ',
  payment_method: 'cash',
  delivery_lat: 0,
  delivery_lng: 0,
  delivery_address_text: 'Equator test address',
  delivery_notes: 'Meet at the lobby',
  is_scheduled: false,
  scheduled_for: null,
  idempotency_key: '44444444-4444-4444-8444-444444444444',
  ...overrides,
});

test('order creation happy path accepts valid payloads, including zero coordinates', () => {
  const result = createOrderRequestSchema.safeParse(createOrderPayload());

  assert.equal(result.success, true);
  assert.equal(result.data.delivery_lat, 0);
  assert.equal(result.data.delivery_lng, 0);
  assert.equal(result.data.promo_code, 'LUNCH-10');
  assert.equal(result.data.idempotency_key, '44444444-4444-4444-8444-444444444444');
});

test('order creation rejects malformed idempotency keys', () => {
  const result = createOrderRequestSchema.safeParse(createOrderPayload({ idempotency_key: 'retry-me' }));

  assert.equal(result.success, false);
  assert.equal(result.error.issues.some((issue) => issue.path.join('.') === 'idempotency_key'), true);
});

test('promo validation rejects malformed codes', () => {
  const result = createOrderRequestSchema.safeParse(createOrderPayload({ promo_code: 'free lunch!' }));

  assert.equal(result.success, false);
  assert.equal(result.error.issues.some((issue) => issue.path.join('.') === 'promo_code'), true);
});

test('scheduled orders require an ISO datetime with timezone', () => {
  const missingDate = createOrderRequestSchema.safeParse(createOrderPayload({ is_scheduled: true }));
  const localDate = createOrderRequestSchema.safeParse(
    createOrderPayload({ is_scheduled: true, scheduled_for: '2026-05-08T12:00:00' })
  );
  const isoDate = createOrderRequestSchema.safeParse(
    createOrderPayload({ is_scheduled: true, scheduled_for: '2026-05-08T12:00:00.000Z' })
  );

  assert.equal(missingDate.success, false);
  assert.equal(localDate.success, false);
  assert.equal(isoDate.success, true);
});

test('order id params must be UUIDs', () => {
  assert.equal(orderIdParamSchema.safeParse(orderId).success, true);
  assert.equal(orderIdParamSchema.safeParse('not-an-id').success, false);
});

test('status action schema accepts known transitions and rejects unsupported actions', () => {
  assert.equal(orderActionRequestSchema.safeParse({ action: 'preparing', estimated_ready_minutes: 20 }).success, true);
  assert.equal(orderActionRequestSchema.safeParse({ action: 'ready_for_pickup' }).success, true);
  assert.equal(orderActionRequestSchema.safeParse({ action: 'teleport' }).success, false);
});

test('driver assignment requires a valid driver email', () => {
  const result = orderActionRequestSchema.safeParse({
    action: 'assign_driver',
    driver_email: ' DRIVER@Example.COM ',
  });

  assert.equal(result.success, true);
  assert.equal(result.data.driver_email, 'driver@example.com');
  assert.equal(orderActionRequestSchema.safeParse({ action: 'assign_driver' }).success, false);
});

test('driver acceptance does not accept caller-supplied driver identity', () => {
  const result = orderActionRequestSchema.safeParse({
    action: 'driver_accept',
    driver_email: 'other-driver@example.com',
  });

  assert.equal(result.success, false);
});
