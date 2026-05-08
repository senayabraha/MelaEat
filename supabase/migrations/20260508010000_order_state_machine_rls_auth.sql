begin;

alter table public.orders
drop constraint if exists orders_payment_status_check;

alter table public.orders
add constraint orders_payment_status_check
check (payment_status in ('pending', 'cash_on_delivery', 'paid', 'failed', 'refunded', 'cancelled'));

create table if not exists public.order_transition_rules (
  action text not null,
  from_status text not null,
  to_status text not null,
  allowed_actor_roles text[] not null,
  requires_restaurant_manager boolean not null default false,
  requires_customer boolean not null default false,
  requires_assigned_driver boolean not null default false,
  requires_driver_available boolean not null default false,
  requires_unassigned_driver boolean not null default false,
  requires_target_driver boolean not null default false,
  description text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  primary key (action, from_status)
);

delete from public.order_transition_rules
where action in (
  'accept',
  'reject',
  'preparing',
  'ready_for_pickup',
  'assign_driver',
  'customer_cancel',
  'driver_accept',
  'picked_up',
  'on_the_way',
  'delivered'
);

insert into public.order_transition_rules (
  action,
  from_status,
  to_status,
  allowed_actor_roles,
  requires_restaurant_manager,
  requires_customer,
  requires_assigned_driver,
  requires_driver_available,
  requires_unassigned_driver,
  requires_target_driver,
  description
)
values
  ('accept', 'pending', 'accepted', array['restaurant', 'admin'], true, false, false, false, false, false, 'Restaurant accepts a pending order.'),
  ('reject', 'pending', 'rejected', array['restaurant', 'admin'], true, false, false, false, false, false, 'Restaurant rejects a pending order.'),
  ('preparing', 'accepted', 'preparing', array['restaurant', 'admin'], true, false, false, false, false, false, 'Restaurant starts preparation.'),
  ('ready_for_pickup', 'preparing', 'ready_for_pickup', array['restaurant', 'admin'], true, false, false, false, false, false, 'Restaurant marks food ready for pickup.'),
  ('assign_driver', 'ready_for_pickup', 'ready_for_pickup', array['restaurant', 'admin'], true, false, false, false, true, true, 'Restaurant assigns an approved online driver.'),
  ('customer_cancel', 'pending', 'cancelled', array['customer', 'admin'], false, true, false, false, false, false, 'Customer cancels before acceptance/prep.'),
  ('customer_cancel', 'accepted', 'cancelled', array['customer', 'admin'], false, true, false, false, false, false, 'Customer cancels before preparation begins.'),
  ('driver_accept', 'ready_for_pickup', 'ready_for_pickup', array['driver'], false, false, false, true, true, false, 'Online driver self-accepts an unassigned pickup.'),
  ('picked_up', 'ready_for_pickup', 'picked_up', array['driver', 'admin'], false, false, true, false, false, false, 'Assigned driver marks the order picked up.'),
  ('on_the_way', 'picked_up', 'on_the_way', array['driver', 'admin'], false, false, true, false, false, false, 'Assigned driver starts delivery.'),
  ('delivered', 'on_the_way', 'delivered', array['driver', 'admin'], false, false, true, false, false, false, 'Assigned driver completes delivery.')
on conflict (action, from_status) do update
set
  to_status = excluded.to_status,
  allowed_actor_roles = excluded.allowed_actor_roles,
  requires_restaurant_manager = excluded.requires_restaurant_manager,
  requires_customer = excluded.requires_customer,
  requires_assigned_driver = excluded.requires_assigned_driver,
  requires_driver_available = excluded.requires_driver_available,
  requires_unassigned_driver = excluded.requires_unassigned_driver,
  requires_target_driver = excluded.requires_target_driver,
  description = excluded.description,
  updated_date = now();

create or replace function public.apply_order_action(
  p_order_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_actor_id uuid := auth.uid();
  v_actor_email text := coalesce(auth.jwt() ->> 'email', '');
  v_actor public.profiles%rowtype;
  v_order public.orders%rowtype;
  v_updated public.orders%rowtype;
  v_rule public.order_transition_rules%rowtype;
  v_restaurant public.restaurants%rowtype;
  v_target_driver public.profiles%rowtype;
  v_patch_status text;
  v_patch_driver_email text;
  v_patch_driver_name text;
  v_patch_payment_status text;
  v_rejection_reason text;
  v_estimated_ready_at timestamptz;
  v_picked_up_at timestamptz;
  v_delivered_at timestamptz;
  v_cash_collected_at timestamptz;
  v_payment_confirmed_at timestamptz;
  v_active_driver_orders integer := 0;
begin
  if v_actor_id is null or nullif(v_actor_email, '') is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select *
  into v_actor
  from public.profiles
  where id = v_actor_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  select *
  into v_rule
  from public.order_transition_rules
  where action = v_action
    and from_status = v_order.status;

  if not found then
    if exists (select 1 from public.order_transition_rules where action = v_action) then
      raise exception 'INVALID_STATUS_TRANSITION' using errcode = 'P0001';
    end if;

    raise exception 'UNSUPPORTED_ORDER_ACTION' using errcode = 'P0001';
  end if;

  if not (coalesce(v_actor.role, 'customer') = any(v_rule.allowed_actor_roles)) then
    raise exception 'ORDER_FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_order.restaurant_id is not null then
    select *
    into v_restaurant
    from public.restaurants
    where id = v_order.restaurant_id;
  end if;

  if v_rule.requires_restaurant_manager
    and not (
      v_actor.role = 'admin'
      or (
        v_actor.role = 'restaurant'
        and v_restaurant.id is not null
        and (
          v_restaurant.owner_email = v_actor_email
          or v_restaurant.id = v_actor.restaurant_id
        )
      )
    )
  then
    raise exception 'ORDER_FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_rule.requires_customer
    and not (v_actor.role = 'admin' or v_order.customer_email = v_actor_email)
  then
    raise exception 'ORDER_FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_rule.requires_assigned_driver
    and not (v_actor.role = 'admin' or (v_actor.role = 'driver' and v_order.driver_email = v_actor_email))
  then
    raise exception 'ORDER_FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_rule.requires_driver_available then
    if v_actor.role <> 'driver' then
      raise exception 'ORDER_FORBIDDEN' using errcode = 'P0001';
    end if;

    if v_actor.driver_approval_status is not null and v_actor.driver_approval_status <> 'approved' then
      raise exception 'DRIVER_NOT_APPROVED' using errcode = 'P0001';
    end if;

    if v_actor.driver_status <> 'online' then
      raise exception 'DRIVER_NOT_ONLINE' using errcode = 'P0001';
    end if;
  end if;

  if v_rule.requires_unassigned_driver and v_order.driver_email is not null then
    raise exception 'DELIVERY_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_patch_status := v_rule.to_status;
  v_patch_driver_email := v_order.driver_email;
  v_patch_driver_name := v_order.driver_name;
  v_patch_payment_status := v_order.payment_status;
  v_rejection_reason := v_order.rejection_reason;
  v_estimated_ready_at := v_order.estimated_ready_at;
  v_picked_up_at := v_order.picked_up_at;
  v_delivered_at := v_order.delivered_at;
  v_cash_collected_at := v_order.cash_collected_at;
  v_payment_confirmed_at := v_order.payment_confirmed_at;

  if v_action = 'reject' then
    v_rejection_reason := coalesce(nullif(btrim(p_payload ->> 'reason'), ''), 'Restaurant unable to fulfill');
  end if;

  if v_action = 'customer_cancel' then
    v_rejection_reason := coalesce(nullif(btrim(p_payload ->> 'reason'), ''), 'Cancelled by customer');

    if v_order.payment_status = 'paid' and v_order.payment_method <> 'cash' then
      v_patch_payment_status := 'refunded';
    elsif v_order.payment_method = 'cash' then
      v_patch_payment_status := 'cancelled';
    elsif v_order.payment_status = 'pending' then
      v_patch_payment_status := 'failed';
    end if;
  end if;

  if v_action = 'preparing' and p_payload ? 'estimated_ready_minutes' then
    v_estimated_ready_at := v_now + (
      greatest(5, least(120, (p_payload ->> 'estimated_ready_minutes')::integer)) * interval '1 minute'
    );
  end if;

  if v_rule.requires_target_driver then
    select *
    into v_target_driver
    from public.profiles
    where email = lower(btrim(p_payload ->> 'driver_email'));

    if not found or v_target_driver.role <> 'driver' then
      raise exception 'DRIVER_NOT_FOUND' using errcode = 'P0001';
    end if;

    if v_target_driver.driver_approval_status is not null and v_target_driver.driver_approval_status <> 'approved' then
      raise exception 'DRIVER_NOT_APPROVED' using errcode = 'P0001';
    end if;

    if v_target_driver.driver_status <> 'online' then
      raise exception 'DRIVER_NOT_ONLINE' using errcode = 'P0001';
    end if;

    v_patch_driver_email := v_target_driver.email;
    v_patch_driver_name := v_target_driver.full_name;
  end if;

  if v_action = 'driver_accept' then
    v_patch_driver_email := v_actor_email;
    v_patch_driver_name := v_actor.full_name;
  end if;

  if v_action = 'picked_up' then
    v_picked_up_at := v_now;
  end if;

  if v_action = 'delivered' then
    v_delivered_at := v_now;

    if v_order.payment_method = 'cash' then
      v_patch_payment_status := 'paid';
      v_cash_collected_at := coalesce(v_cash_collected_at, v_now);
      v_payment_confirmed_at := coalesce(v_payment_confirmed_at, v_now);
    end if;
  end if;

  update public.orders orders
  set
    status = v_patch_status,
    driver_email = v_patch_driver_email,
    driver_name = v_patch_driver_name,
    payment_status = v_patch_payment_status,
    rejection_reason = v_rejection_reason,
    estimated_ready_at = v_estimated_ready_at,
    picked_up_at = v_picked_up_at,
    delivered_at = v_delivered_at,
    cash_collected_at = v_cash_collected_at,
    payment_confirmed_at = v_payment_confirmed_at,
    accepted_at = case
      when v_action = 'accept' and orders.accepted_at is null then v_now
      else orders.accepted_at
    end,
    updated_date = v_now
  where orders.id = v_order.id
    and orders.status = v_order.status
    and orders.driver_email is not distinct from v_order.driver_email
  returning *
  into v_updated;

  if not found then
    raise exception 'ORDER_UPDATE_CONFLICT' using errcode = 'P0001';
  end if;

  insert into public.order_status_events (
    order_id,
    actor_email,
    actor_role,
    action,
    from_status,
    to_status,
    note
  )
  values (
    v_updated.id,
    v_actor_email,
    coalesce(v_actor.role, 'customer'),
    v_action,
    v_order.status,
    v_updated.status,
    nullif(btrim(p_payload ->> 'reason'), '')
  );

  if v_action = 'driver_accept' then
    update public.profiles
    set driver_status = 'on_delivery', updated_date = v_now
    where id = v_actor.id;
  end if;

  if v_action = 'delivered' and v_order.driver_email is not null then
    select count(*)
    into v_active_driver_orders
    from public.orders
    where driver_email = v_order.driver_email
      and status in ('ready_for_pickup', 'picked_up', 'on_the_way');

    update public.profiles
    set
      driver_status = case when v_active_driver_orders > 0 then 'on_delivery' else 'online' end,
      driver_total_deliveries = coalesce(driver_total_deliveries, 0) + 1,
      driver_total_earnings = coalesce(driver_total_earnings, 0) + coalesce(v_order.delivery_fee, 0),
      updated_date = v_now
    where email = v_order.driver_email;
  end if;

  return v_updated;
end;
$$;

revoke all on function public.apply_order_action(uuid, text, jsonb) from public;
revoke all on function public.apply_order_action(uuid, text, jsonb) from anon;
grant execute on function public.apply_order_action(uuid, text, jsonb) to authenticated;

alter table public.order_transition_rules enable row level security;

drop policy if exists "order transition rules read authenticated" on public.order_transition_rules;
create policy "order transition rules read authenticated" on public.order_transition_rules
for select
to authenticated
using (true);

drop policy if exists "order insert customer or admin" on public.orders;
drop policy if exists "order update admin only" on public.orders;
drop policy if exists "order event insert participants" on public.order_status_events;

drop policy if exists "promotion read access" on public.promotions;
create policy "promotion read access" on public.promotions
for select
using (
  (is_active = true)
  or public.is_admin()
  or (restaurant_id is not null and public.can_manage_restaurant(restaurant_id))
);

drop policy if exists "issue read order participants" on public.issue_reports;
create policy "issue read order participants" on public.issue_reports
for select
to authenticated
using (
  public.is_admin()
  or reporter_email = public.current_user_email()
  or (order_id is not null and public.can_access_order(order_id))
);

drop policy if exists "issue update restaurant driver admin" on public.issue_reports;
create policy "issue update restaurant driver admin" on public.issue_reports
for update
to authenticated
using (
  public.is_admin()
  or reporter_email = public.current_user_email()
  or (order_id is not null and public.can_access_order(order_id))
)
with check (
  public.is_admin()
  or reporter_email = public.current_user_email()
  or (order_id is not null and public.can_access_order(order_id))
);

commit;
