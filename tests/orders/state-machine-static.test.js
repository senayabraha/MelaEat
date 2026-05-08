import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260508010000_order_state_machine_rls_auth.sql', 'utf8');
const schema = readFileSync('sql/schema.sql', 'utf8');

test('order state machine migration defines every compatibility action', () => {
  const expectedActions = [
    'accept',
    'reject',
    'preparing',
    'ready_for_pickup',
    'assign_driver',
    'customer_cancel',
    'driver_accept',
    'picked_up',
    'on_the_way',
    'delivered',
  ];

  for (const action of expectedActions) {
    assert.match(migration, new RegExp(`'${action}'`));
  }

  assert.match(migration, /create table if not exists public\.order_transition_rules/);
  assert.match(migration, /create or replace function public\.apply_order_action/);
  assert.match(migration, /orders\.status = v_order\.status/);
  assert.match(migration, /orders\.driver_email is not distinct from v_order\.driver_email/);
});

test('canonical schema includes the order state machine', () => {
  assert.match(schema, /create table if not exists public\.order_transition_rules/);
  assert.match(schema, /create or replace function public\.apply_order_action/);
  assert.match(schema, /grant execute on function public\.apply_order_action\(uuid, text, jsonb\) to authenticated/);
});

