# Order API Baseline Metrics

Use this sheet before and after order/payment route changes. The target window for a first baseline is the most recent 7 complete days.

## Dashboard Tiles

| Metric | Source | Filter | Calculation |
| --- | --- | --- | --- |
| Order creation success rate | Vercel logs + Supabase `orders` | `POST /api/orders` | `2xx responses / all responses` |
| Order creation failure rate | Vercel logs | `POST /api/orders` | `non-2xx responses / all responses` grouped by `code` |
| `/api/orders` average latency | Vercel function duration | `POST /api/orders` | `avg(duration_ms)` |
| `/api/orders` p95 latency | Vercel function duration | `POST /api/orders` | `p95(duration_ms)` |
| Action success/failure rate | Vercel logs + `order_status_events` | `POST /api/orders/*/action` | `2xx and non-2xx responses` grouped by `action` and `code` |
| Action average and p95 latency | Vercel function duration | `POST /api/orders/*/action` | `avg(duration_ms)`, `p95(duration_ms)` |
| Promo application error rate | Vercel logs | `POST /api/orders` | responses with `code in ('INVALID_PROMO_CODE', 'PROMO_NOT_APPLICABLE') / requests with promo payload` |

## Supabase Queries

Successful order creation volume:

```sql
select
  date_trunc('day', created_date) as day,
  count(*) as successful_orders
from public.orders
where created_date >= now() - interval '7 days'
group by 1
order by 1;
```

Promo success proxy:

```sql
select
  date_trunc('day', created_date) as day,
  count(*) filter (where promo_code is not null) as orders_with_promo,
  count(*) as total_orders,
  round(
    100.0 * count(*) filter (where promo_code is not null) / nullif(count(*), 0),
    2
  ) as promo_order_percent
from public.orders
where created_date >= now() - interval '7 days'
group by 1
order by 1;
```

Status action volume:

```sql
select
  date_trunc('day', created_date) as day,
  action,
  count(*) as events
from public.order_status_events
where created_date >= now() - interval '7 days'
group by 1, 2
order by 1, 2;
```

Driver assignment and acceptance outcomes:

```sql
select
  action,
  from_status,
  to_status,
  count(*) as events
from public.order_status_events
where created_date >= now() - interval '7 days'
  and action in ('assign_driver', 'driver_accept')
group by 1, 2, 3
order by 1, 2, 3;
```

## Vercel Log Queries

Use Vercel Observability or log drains with these filters:

```text
method:POST path:/api/orders
method:POST path:/api/orders/*/action
code:VALIDATION_ERROR path:/api/orders*
code:INVALID_PROMO_CODE OR code:PROMO_NOT_APPLICABLE
```

Record average and p95 duration for each route, then store the baseline snapshot with the deploy SHA and date.

