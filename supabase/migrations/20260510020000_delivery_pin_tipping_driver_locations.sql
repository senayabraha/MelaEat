-- Adds three customer-facing capabilities in one migration so the deploy
-- is atomic and the trigger / RLS dependencies see a consistent schema:
--   1. delivery_code  -- deterministic 4-digit PIN gate for handoff
--   2. tip_amount     -- driver tip captured at checkout or post-delivery
--   3. driver_locations + RLS -- live driver GPS visible only to assigned customers

------------------------------------------------------------------------------
-- 1. Delivery PIN
------------------------------------------------------------------------------
-- Derived deterministically from the order id. Generated column means
-- restaurant receipts, the customer's phone, and the driver app all compute
-- the exact same digits without an extra round-trip or persistence concern.

-- The pin derivation must exist before the generated column references it.
create or replace function public.derive_delivery_pin(p_id uuid)
returns text
language sql
immutable
as $$
  select lpad(((('x' || substr(replace(p_id::text, '-', ''), 1, 8))::bit(32)::int & 9999))::text, 4, '0');
$$;

-- Add columns FIRST. `language sql` functions below resolve their bodies
-- against the live catalog at CREATE time, so any column they reference
-- has to exist already.
alter table public.orders
add column if not exists delivery_code text
  generated always as (public.derive_delivery_pin(id)) stored;

create index if not exists orders_delivery_code_idx on public.orders(delivery_code);

-- Audit trail for failed PIN attempts and overrides. Drivers see the count;
-- support sees the trail.
alter table public.orders
add column if not exists delivery_code_attempts integer not null default 0,
add column if not exists delivery_code_overridden_by text,
add column if not exists delivery_code_overridden_reason text,
add column if not exists delivery_code_overridden_at timestamptz;

-- Bumps the failed-attempt counter from outside the rolled-back delivered
-- transaction. Intentionally service_role-only — the action endpoint calls
-- it after a PIN_MISMATCH from apply_order_action.
create or replace function public.increment_delivery_code_attempts(p_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.orders
  set delivery_code_attempts = coalesce(delivery_code_attempts, 0) + 1,
      updated_date = now()
  where id = p_order_id;
$$;

revoke all on function public.increment_delivery_code_attempts(uuid) from public;
revoke all on function public.increment_delivery_code_attempts(uuid) from anon;
revoke all on function public.increment_delivery_code_attempts(uuid) from authenticated;
grant execute on function public.increment_delivery_code_attempts(uuid) to service_role;

------------------------------------------------------------------------------
-- 2. Tipping
------------------------------------------------------------------------------
alter table public.orders
add column if not exists tip_amount numeric(10,2) not null default 0,
add column if not exists tip_added_at timestamptz;

-- The total column is updated by `create_order_atomic` (checkout-time tip)
-- and by the post-delivery tip endpoint. We don't recompute total via a
-- trigger because the order pipeline already owns the math.

------------------------------------------------------------------------------
-- 3. Live driver locations
------------------------------------------------------------------------------
create table if not exists public.driver_locations (
  driver_email text primary key,
  lat double precision not null,
  lng double precision not null,
  heading real,
  speed real,
  accuracy real,
  updated_at timestamptz not null default now()
);

create index if not exists driver_locations_updated_idx
  on public.driver_locations(updated_at desc);

alter table public.driver_locations enable row level security;

drop policy if exists "driver writes own location" on public.driver_locations;
create policy "driver writes own location" on public.driver_locations
for all
to authenticated
using (driver_email = auth.jwt() ->> 'email')
with check (driver_email = auth.jwt() ->> 'email');

drop policy if exists "customer reads assigned driver location" on public.driver_locations;
create policy "customer reads assigned driver location" on public.driver_locations
for select
to authenticated
using (
  driver_email = auth.jwt() ->> 'email'
  or public.is_admin()
  or exists (
    select 1
    from public.orders o
    where o.driver_email = driver_locations.driver_email
      and o.customer_email = auth.jwt() ->> 'email'
      and o.status in ('picked_up','on_the_way')
  )
);

-- Realtime publication so the customer's OrderTracking page receives
-- websocket pushes. Adding to the existing supabase_realtime publication
-- is idempotent because we wrap it in a try/except via DO block.
do $$
begin
  alter publication supabase_realtime add table public.driver_locations;
exception
  when duplicate_object then null;
  when others then null;
end$$;

------------------------------------------------------------------------------
-- 4. apply_order_action: enforce delivery PIN before allowing 'delivered'
------------------------------------------------------------------------------
-- Drivers must pass delivery_code in the action payload. Three failed
-- attempts blocks further attempts until an admin (or restaurant) override.
-- Override path is allowed but stamped + audited.

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
  v_supplied_pin text;
  v_override boolean := false;
  v_override_reason text;
  v_attempts integer;
  v_pin_overridden_by text;
  v_pin_overridden_reason text;
  v_pin_overridden_at timestamptz;
begin
  if v_actor_id is null or nullif(v_actor_email, '') is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_actor from public.profiles where id = v_actor_id;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0001';
  end if;

  select *
  into v_rule
  from public.order_transition_rules
  where action = v_action and from_status = v_order.status;

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
    select * into v_restaurant from public.restaurants where id = v_order.restaurant_id;
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
  v_attempts := coalesce(v_order.delivery_code_attempts, 0);
  v_pin_overridden_by := v_order.delivery_code_overridden_by;
  v_pin_overridden_reason := v_order.delivery_code_overridden_reason;
  v_pin_overridden_at := v_order.delivery_code_overridden_at;

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

    -- PIN gate. Admin or restaurant manager can override with a reason.
    -- Drivers must supply the correct PIN.
    v_supplied_pin := nullif(btrim(p_payload ->> 'delivery_code'), '');
    v_override := coalesce((p_payload ->> 'override')::boolean, false);
    v_override_reason := nullif(btrim(p_payload ->> 'override_reason'), '');

    if v_override then
      if not (
        v_actor.role = 'admin'
        or (
          v_actor.role = 'restaurant'
          and v_restaurant.id is not null
          and (v_restaurant.owner_email = v_actor_email or v_restaurant.id = v_actor.restaurant_id)
        )
      ) then
        raise exception 'PIN_OVERRIDE_FORBIDDEN' using errcode = 'P0001';
      end if;
      if v_override_reason is null or length(v_override_reason) < 5 then
        raise exception 'PIN_OVERRIDE_REASON_REQUIRED' using errcode = 'P0001';
      end if;
      v_pin_overridden_by := v_actor_email;
      v_pin_overridden_reason := v_override_reason;
      v_pin_overridden_at := v_now;
    elsif v_actor.role = 'driver' then
      if v_attempts >= 3 then
        raise exception 'PIN_LOCKED' using errcode = 'P0001';
      end if;
      if v_supplied_pin is null then
        raise exception 'PIN_REQUIRED' using errcode = 'P0001';
      end if;
      if v_supplied_pin <> coalesce(v_order.delivery_code, public.derive_delivery_pin(v_order.id)) then
        -- The action endpoint increments delivery_code_attempts on PIN_MISMATCH
        -- via the admin client, since raising here rolls back any update we
        -- attempt inside this transaction.
        raise exception 'PIN_MISMATCH' using errcode = 'P0001';
      end if;
    end if;

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
    delivery_code_overridden_by = v_pin_overridden_by,
    delivery_code_overridden_reason = v_pin_overridden_reason,
    delivery_code_overridden_at = v_pin_overridden_at,
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
    order_id, actor_email, actor_role, action, from_status, to_status, note
  )
  values (
    v_updated.id,
    v_actor_email,
    coalesce(v_actor.role, 'customer'),
    v_action,
    v_order.status,
    v_updated.status,
    case
      when v_action = 'delivered' and v_override then 'PIN override: ' || coalesce(v_override_reason, '')
      else nullif(btrim(p_payload ->> 'reason'), '')
    end
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

    -- Stop broadcasting location once delivered. Customer privacy is the goal:
    -- the customer should never see this driver's live position once delivery
    -- is complete, even though our RLS policy would already block it.
    delete from public.driver_locations
    where driver_email = v_order.driver_email
      and not exists (
        select 1 from public.orders
        where driver_email = v_order.driver_email
          and status in ('picked_up','on_the_way')
      );
  end if;

  return v_updated;
end;
$$;

revoke all on function public.apply_order_action(uuid, text, jsonb) from public;
revoke all on function public.apply_order_action(uuid, text, jsonb) from anon;
grant execute on function public.apply_order_action(uuid, text, jsonb) to authenticated;

------------------------------------------------------------------------------
-- 5. create_order_atomic: capture optional checkout-time tip in total
------------------------------------------------------------------------------
create or replace function public.create_order_atomic(
  p_customer_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_actor_role text,
  p_order jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_restaurant_id uuid := (p_order ->> 'restaurant_id')::uuid;
  v_customer_phone text := nullif(btrim(p_order ->> 'customer_phone'), '');
  v_restaurant_name text := nullif(btrim(p_order ->> 'restaurant_name'), '');
  v_items jsonb := coalesce(p_order -> 'items', '[]'::jsonb);
  v_subtotal numeric := coalesce((p_order ->> 'subtotal')::numeric, 0);
  v_base_delivery_fee numeric := coalesce((p_order ->> 'delivery_fee')::numeric, 0);
  v_delivery_fee numeric := v_base_delivery_fee;
  v_discount numeric := 0;
  v_tip numeric := greatest(0, coalesce((p_order ->> 'tip_amount')::numeric, 0));
  v_total numeric := 0;
  v_promo_code text := nullif(upper(btrim(p_order ->> 'promo_code')), '');
  v_payment_method text := coalesce(nullif(p_order ->> 'payment_method', ''), 'cash');
  v_payment_status text := case
    when v_payment_method = 'cash' then 'cash_on_delivery'
    else 'pending'
  end;
  v_delivery_lat numeric := (p_order ->> 'delivery_lat')::numeric;
  v_delivery_lng numeric := (p_order ->> 'delivery_lng')::numeric;
  v_delivery_address_text text := coalesce(p_order ->> 'delivery_address_text', '');
  v_delivery_notes text := coalesce(p_order ->> 'delivery_notes', '');
  v_is_scheduled boolean := coalesce((p_order ->> 'is_scheduled')::boolean, false);
  v_scheduled_for timestamptz := nullif(p_order ->> 'scheduled_for', '')::timestamptz;
  v_idempotency_key text := nullif(btrim(p_order ->> 'idempotency_key'), '');
  v_promo public.promotions%rowtype;
  v_existing_order public.orders%rowtype;
  v_order public.orders%rowtype;
begin
  if p_customer_id is null or nullif(btrim(p_customer_email), '') is null then
    raise exception 'ORDER_CUSTOMER_REQUIRED' using errcode = 'P0001';
  end if;

  if v_idempotency_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_customer_email || ':' || v_idempotency_key, 0));
    select * into v_existing_order
    from public.orders
    where customer_email = p_customer_email and idempotency_key = v_idempotency_key
    limit 1;
    if found then return v_existing_order; end if;
  end if;

  if v_promo_code is not null then
    select * into v_promo
    from public.promotions
    where upper(code) = v_promo_code
      and (restaurant_id is null or restaurant_id = v_restaurant_id)
    order by case when restaurant_id = v_restaurant_id then 0 else 1 end, created_date desc, id
    limit 1;
    if not found then
      if exists (select 1 from public.promotions where upper(code) = v_promo_code) then
        raise exception 'PROMO_NOT_APPLICABLE' using errcode = 'P0001';
      end if;
      raise exception 'INVALID_PROMO_CODE' using errcode = 'P0001';
    end if;
    if not v_promo.is_active then raise exception 'INVALID_PROMO_CODE' using errcode = 'P0001'; end if;
    if v_promo.starts_at is not null and v_promo.starts_at > v_now then raise exception 'PROMO_NOT_STARTED' using errcode = 'P0001'; end if;
    if v_promo.ends_at is not null and v_promo.ends_at < v_now then raise exception 'PROMO_EXPIRED' using errcode = 'P0001'; end if;
    if v_promo.usage_limit is not null and v_promo.times_used >= v_promo.usage_limit then raise exception 'PROMO_USAGE_LIMIT_REACHED' using errcode = 'P0001'; end if;
    if v_promo.min_order is not null and v_subtotal < v_promo.min_order then raise exception 'PROMO_MIN_ORDER_NOT_MET' using errcode = 'P0001'; end if;

    with promo_candidate as (
      select id from public.promotions
      where id = v_promo.id and is_active = true
        and (starts_at is null or starts_at <= v_now)
        and (ends_at is null or ends_at >= v_now)
        and (usage_limit is null or times_used < usage_limit)
        and (min_order is null or v_subtotal >= min_order)
      for update
    )
    update public.promotions promotion
    set times_used = promotion.times_used + 1, updated_date = v_now
    from promo_candidate
    where promotion.id = promo_candidate.id
    returning promotion.* into v_promo;

    if not found then raise exception 'PROMO_USAGE_LIMIT_REACHED' using errcode = 'P0001'; end if;

    if v_promo.discount_type = 'free_delivery' then
      v_delivery_fee := 0; v_discount := 0;
    elsif v_promo.discount_type = 'percentage' then
      v_discount := least(round((v_subtotal * coalesce(v_promo.discount_value, 0)) / 100), v_subtotal);
    else
      v_discount := least(coalesce(v_promo.discount_value, 0), v_subtotal);
    end if;
  end if;

  v_total := greatest(0, v_subtotal + v_delivery_fee - v_discount + v_tip);

  insert into public.orders (
    customer_email, customer_name, customer_phone, restaurant_id, restaurant_name,
    items, subtotal, delivery_fee, discount, tip_amount, total, promo_code,
    payment_method, payment_status, delivery_lat, delivery_lng,
    delivery_address_text, delivery_notes, is_scheduled, scheduled_for,
    status, accepted_at, idempotency_key, tip_added_at, updated_date
  )
  values (
    p_customer_email, coalesce(nullif(btrim(p_customer_name), ''), p_customer_email),
    v_customer_phone, v_restaurant_id, v_restaurant_name, v_items,
    v_subtotal, v_delivery_fee, v_discount, v_tip, v_total, v_promo_code,
    v_payment_method, v_payment_status, v_delivery_lat, v_delivery_lng,
    v_delivery_address_text, v_delivery_notes, v_is_scheduled, v_scheduled_for,
    'accepted', v_now, v_idempotency_key,
    case when v_tip > 0 then v_now else null end,
    v_now
  )
  returning * into v_order;

  update public.profiles
  set phone = v_customer_phone, default_lat = v_delivery_lat,
      default_lng = v_delivery_lng, default_address_text = v_delivery_address_text,
      updated_date = v_now
  where id = p_customer_id;

  insert into public.order_status_events (order_id, actor_email, actor_role, action, from_status, to_status, note)
  values (
    v_order.id, p_customer_email, coalesce(nullif(btrim(p_actor_role), ''), 'customer'),
    'created_auto_accepted', null, 'accepted', 'Order created and accepted automatically'
  );

  return v_order;
end;
$$;

revoke all on function public.create_order_atomic(uuid, text, text, text, jsonb) from public;
revoke all on function public.create_order_atomic(uuid, text, text, text, jsonb) from anon;
revoke all on function public.create_order_atomic(uuid, text, text, text, jsonb) from authenticated;
grant execute on function public.create_order_atomic(uuid, text, text, text, jsonb) to service_role;
