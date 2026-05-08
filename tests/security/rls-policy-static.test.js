import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const schema = readFileSync('sql/schema.sql', 'utf8');

test('orders cannot be directly inserted or updated by authenticated clients', () => {
  assert.doesNotMatch(schema, /create policy "order insert customer or admin"/);
  assert.doesNotMatch(schema, /create policy "order update admin only"/);
});

test('order status events cannot be directly inserted by authenticated clients', () => {
  assert.doesNotMatch(schema, /create policy "order event insert participants"/);
  assert.match(schema, /create policy "order event read participants"/);
});

test('promotion read policy does not expose inactive global promotions', () => {
  const start = schema.indexOf('create policy "promotion read access"');
  const end = schema.indexOf('create policy "promotion write managed restaurants"', start);
  const promotionReadPolicy = schema.slice(start, end);

  assert.notEqual(start, -1);
  assert.doesNotMatch(promotionReadPolicy, /or restaurant_id is null/);
});
