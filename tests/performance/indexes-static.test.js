import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260508020000_order_dashboard_indexes.sql', 'utf8');
const schema = readFileSync('sql/schema.sql', 'utf8');

const requiredIndexes = [
  'orders_restaurant_status_created_desc_idx',
  'orders_restaurant_created_desc_idx',
  'orders_driver_status_updated_desc_idx',
  'orders_driver_status_created_desc_idx',
  'orders_customer_created_desc_idx',
  'orders_created_desc_idx',
  'orders_ready_unassigned_created_desc_idx',
  'order_status_events_order_created_desc_idx',
];

test('dashboard index migration includes every targeted query index', () => {
  for (const indexName of requiredIndexes) {
    assert.match(migration, new RegExp(`create index if not exists ${indexName}`));
  }

  assert.match(migration, /on public\.orders\(restaurant_id, status, created_date desc\)/);
  assert.match(migration, /on public\.orders\(driver_email, status, updated_date desc\)/);
  assert.match(migration, /where status = 'ready_for_pickup'\s+and driver_email is null/);
});

test('canonical schema stays aligned with dashboard index migration', () => {
  for (const indexName of requiredIndexes) {
    assert.match(schema, new RegExp(`create index if not exists ${indexName}`));
  }
});
