# Synthetic Dashboard Load Checks

The opt-in test in `tests/performance/dashboard-load.test.js` measures representative Supabase client queries for:

- Admin recent orders.
- Restaurant order list.
- Driver active queue.
- Driver available pickups.

Run against a staging Supabase project after applying the index migration:

```bash
RUN_SUPABASE_DASHBOARD_LOAD_TESTS=1 node --test tests/performance/dashboard-load.test.js
```

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Optional `LOAD_RESTAURANT_ID`
- Optional `LOAD_DRIVER_EMAIL`
- Optional `LOAD_ITERATIONS` (default `5`)
- Optional `LOAD_P95_MS` (default `1500`)

Record p50/p95 durations before and after the migration in `docs/performance/order-dashboard-query-report.md`.
