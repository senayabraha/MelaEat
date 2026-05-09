create index if not exists orders_restaurant_status_created_desc_idx
on public.orders(restaurant_id, status, created_date desc);

create index if not exists orders_restaurant_created_desc_idx
on public.orders(restaurant_id, created_date desc);

create index if not exists orders_driver_status_updated_desc_idx
on public.orders(driver_email, status, updated_date desc);

create index if not exists orders_driver_status_created_desc_idx
on public.orders(driver_email, status, created_date desc);

create index if not exists orders_customer_created_desc_idx
on public.orders(customer_email, created_date desc);

create index if not exists orders_created_desc_idx
on public.orders(created_date desc);

create index if not exists orders_ready_unassigned_created_desc_idx
on public.orders(created_date desc)
where status = 'ready_for_pickup'
  and driver_email is null;

create index if not exists order_status_events_order_created_desc_idx
on public.order_status_events(order_id, created_date desc);

