# Order Dashboard Query Report

Date: 2026-05-08

## Query Patterns

| Surface | Query shape | Index |
| --- | --- | --- |
| Restaurant orders | `restaurant_id = ? order by created_date desc limit N` | `orders_restaurant_created_desc_idx` |
| Restaurant status buckets | `restaurant_id = ? and status = ? order by created_date desc` | `orders_restaurant_status_created_desc_idx` |
| Driver active queue | `driver_email = ? and status in (...) order by updated_date desc limit N` | `orders_driver_status_updated_desc_idx` |
| Driver earnings/history | `driver_email = ? and status = ? order by created_date desc` | `orders_driver_status_created_desc_idx` |
| Driver available pickups | `status = 'ready_for_pickup' and driver_email is null order by created_date desc` | `orders_ready_unassigned_created_desc_idx` |
| Customer order history | `customer_email = ? order by created_date desc limit N` | `orders_customer_created_desc_idx` |
| Admin recent orders | `order by created_date desc limit N` | `orders_created_desc_idx` |
| Order audit trail | `order_id = ? order by created_date desc` | `order_status_events_order_created_desc_idx` |

## Explain Plan Checklist

Run after applying `supabase/migrations/20260508020000_order_dashboard_indexes.sql`:

```sql
explain (analyze, buffers)
select *
from public.orders
where restaurant_id = '<restaurant-id>'::uuid
order by created_date desc
limit 200;

explain (analyze, buffers)
select *
from public.orders
where restaurant_id = '<restaurant-id>'::uuid
  and status in ('accepted', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way')
order by created_date desc
limit 200;

explain (analyze, buffers)
select *
from public.orders
where driver_email = '<driver-email>'
  and status in ('ready_for_pickup', 'picked_up', 'on_the_way')
order by updated_date desc
limit 20;

explain (analyze, buffers)
select *
from public.orders
where status = 'ready_for_pickup'
  and driver_email is null
order by created_date desc
limit 50;

explain (analyze, buffers)
select *
from public.orders
order by created_date desc
limit 200;
```

Expected after state:

- Index scan or bitmap index scan for filtered dashboards.
- No full table scan for driver available pickups.
- No explicit sort node for the primary `limit` queries when the matching descending index can satisfy order.

## Unused Index Review

No existing single-column indexes were removed in this phase. They are still low-risk helpers for RLS predicates and point filters. Revisit after at least 7 days of production traffic:

```sql
select
  schemaname,
  relname,
  indexrelname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
from pg_stat_user_indexes
where schemaname = 'public'
  and relname in ('orders', 'order_status_events')
order by idx_scan asc, pg_relation_size(indexrelid) desc;
```

Only remove an index after confirming low `idx_scan`, no matching query shape, and no RLS/predicate dependency.

