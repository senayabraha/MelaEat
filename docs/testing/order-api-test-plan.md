# Order API Test Plan

## Current Harness

The initial harness uses the built-in Node test runner. Run focused order API contract tests with:

```bash
npm run test:orders
```

The order RPC integration tests are opt-in because they write to a real Supabase database:

```bash
RUN_SUPABASE_ORDER_RPC_TESTS=1 npm run test:orders
```

It requires `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`.

## Phase 0 Coverage

- Order creation happy path validates a complete checkout payload.
- Promo validation normalizes accepted promo codes and rejects malformed values.
- Status action validation accepts known actions and rejects unsupported ones.
- Driver assignment requires a manager-supplied driver email.
- Driver acceptance rejects caller-supplied driver identity so the route must use the authenticated driver.
- Checkout accepts a UUID idempotency key for retry protection.
- Promo redemption load test proves `usage_limit` cannot be exceeded under concurrent RPC calls.
- RPC rollback test proves a later insert failure rolls back promo usage.
- State-machine static test verifies all compatibility action names are present in the DB transition matrix.
- RLS static test verifies direct order insert/update and audit-event insert policies are absent from the canonical schema.

## Next Integration Coverage

Use a disposable Supabase project or transaction-wrapped test schema for these cases:

- Create an order with an in-stock menu item and verify totals, status, payment status, and audit event.
- Apply percentage, fixed, free delivery, restaurant-scoped, expired, and minimum-order promos.
- Move an order through `accepted -> preparing -> ready_for_pickup -> picked_up -> on_the_way -> delivered`.
- Race two drivers accepting the same unassigned `ready_for_pickup` order and assert exactly one succeeds.
- Race restaurant assignment and driver self-acceptance and assert stale update protection returns `409`.
- Verify cash orders become `paid` only on delivery.
