create extension if not exists "pgcrypto";

create sequence if not exists public.order_number_seq;

create or replace function public.next_order_number()
returns text
language sql
volatile
as $$
  select 'ME-' || lpad(nextval('public.order_number_seq')::text, 10, '0');
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'user' check (role in ('user', 'customer', 'restaurant', 'driver', 'admin')),
  phone text,
  restaurant_id uuid,
  favorite_restaurant_ids uuid[] not null default '{}',
  default_lat numeric,
  default_lng numeric,
  default_address_text text,
  driver_status text not null default 'offline' check (driver_status in ('offline', 'online', 'on_delivery')),
  driver_approval_status text not null default 'approved' check (driver_approval_status in ('pending', 'approved', 'suspended')),
  driver_vehicle_type text,
  driver_license_plate text,
  driver_rating numeric not null default 5,
  driver_total_deliveries integer not null default 0,
  driver_total_earnings numeric not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.profiles
add column if not exists driver_approval_status text not null default 'approved'
check (driver_approval_status in ('pending', 'approved', 'suspended'));

update public.profiles
set driver_approval_status = 'pending'
where role = 'driver'
  and driver_approval_status is null;

create or replace function public.set_profile_onboarding_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'driver' and (new.driver_approval_status is null or new.driver_approval_status = 'approved') then
    new.driver_approval_status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists set_profile_onboarding_defaults_trigger on public.profiles;
create trigger set_profile_onboarding_defaults_trigger
before insert on public.profiles
for each row execute function public.set_profile_onboarding_defaults();

create or replace function public.prevent_profile_sensitive_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if old.role is distinct from new.role
    or old.restaurant_id is distinct from new.restaurant_id
    or old.driver_approval_status is distinct from new.driver_approval_status
  then
    raise exception 'Only admins can update role, restaurant link, or driver approval status.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_profile_sensitive_self_update_trigger on public.profiles;
create trigger prevent_profile_sensitive_self_update_trigger
before update on public.profiles
for each row execute function public.prevent_profile_sensitive_self_update();

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_email text,
  cover_image_url text,
  logo_url text,
  cuisines text[] not null default '{}',
  city text not null default 'Addis Ababa',
  address_text text,
  lat numeric,
  lng numeric,
  phone text,
  is_open_manual boolean not null default true,
  operating_hours jsonb not null default '{}',
  delivery_fee numeric not null default 50,
  minimum_order numeric not null default 0,
  estimated_prep_minutes integer not null default 25,
  rating numeric not null default 0,
  total_ratings integer not null default 0,
  is_featured boolean not null default false,
  commission_rate numeric not null default 0.15,
  status text not null default 'approved' check (status in ('pending', 'approved', 'suspended')),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null,
  description text,
  price numeric not null default 0,
  image_url text,
  in_stock boolean not null default true,
  is_featured boolean not null default false,
  is_vegetarian boolean not null default false,
  is_spicy boolean not null default false,
  options jsonb not null default '[]',
  sort_order integer not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null default public.next_order_number(),
  customer_email text,
  customer_name text,
  customer_phone text,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  restaurant_name text,
  driver_email text,
  driver_name text,
  items jsonb not null default '[]',
  subtotal numeric not null default 0,
  delivery_fee numeric not null default 0,
  service_fee numeric not null default 0,
  discount numeric not null default 0,
  total numeric not null default 0,
  promo_code text,
  payment_method text not null default 'cash' check (payment_method in ('cash', 'telebirr', 'card')),
  payment_status text not null default 'cash_on_delivery' check (payment_status in ('pending', 'cash_on_delivery', 'paid', 'failed', 'refunded', 'cancelled')),
  delivery_lat numeric,
  delivery_lng numeric,
  delivery_address_text text,
  delivery_notes text,
  scheduled_for timestamptz,
  is_scheduled boolean not null default false,
  status text not null default 'accepted' check (status in ('pending', 'accepted', 'rejected', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered', 'cancelled')),
  rejection_reason text,
  estimated_ready_at timestamptz,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  cash_collected_at timestamptz,
  payment_confirmed_at timestamptz,
  payment_note text,
  idempotency_key text,
  customer_rating_restaurant numeric,
  customer_rating_driver numeric,
  customer_review text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

alter table public.orders
alter column status set default 'accepted';

alter table public.orders
alter column payment_status set default 'cash_on_delivery';

alter table public.orders
add column if not exists cash_collected_at timestamptz,
add column if not exists payment_confirmed_at timestamptz,
add column if not exists payment_note text,
add column if not exists idempotency_key text;

with order_number_sequence_floor as (
  select greatest(
    coalesce((
      select max(substring(order_number from '^ME-([0-9]{10})$')::bigint)
      from public.orders
      where order_number ~ '^ME-[0-9]{10}$'
    ), 0),
    coalesce((select count(*) from public.orders), 0)
  ) as floor_value
)
select setval(
  'public.order_number_seq',
  greatest(floor_value, 1),
  floor_value > 0
)
from order_number_sequence_floor;

with order_number_audit as (
  select
    id,
    order_number,
    row_number() over (
      partition by order_number
      order by created_date nulls last, id
    ) as duplicate_rank
  from public.orders
),
orders_requiring_number as (
  select id
  from order_number_audit
  where order_number is null
    or btrim(order_number) = ''
    or order_number !~ '^ME-[A-Z0-9]{6,16}$'
    or duplicate_rank > 1
)
update public.orders orders
set
  order_number = public.next_order_number(),
  updated_date = now()
from orders_requiring_number backfill
where orders.id = backfill.id;

alter table public.orders
alter column order_number set default public.next_order_number();

alter table public.orders
alter column order_number set not null;

alter table public.orders
drop constraint if exists orders_order_number_format_check;

alter table public.orders
add constraint orders_order_number_format_check
check (order_number ~ '^ME-[A-Z0-9]{6,16}$');

alter table public.orders
drop constraint if exists orders_payment_status_check;

alter table public.orders
add constraint orders_payment_status_check
check (payment_status in ('pending', 'cash_on_delivery', 'paid', 'failed', 'refunded', 'cancelled'));

update public.orders
set payment_status = 'cash_on_delivery'
where payment_method = 'cash'
  and payment_status = 'pending'
  and status <> 'delivered';

update public.orders
set payment_status = 'paid'
where payment_method = 'cash'
  and status = 'delivered';

create or replace function public.auto_accept_customer_order()
returns trigger
language plpgsql
as $$
begin
  if new.status is null or new.status = 'pending' then
    new.status := 'accepted';
  end if;

  if new.status = 'accepted' and new.accepted_at is null then
    new.accepted_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists auto_accept_customer_order_trigger on public.orders;
create trigger auto_accept_customer_order_trigger
before insert on public.orders
for each row execute function public.auto_accept_customer_order();

create or replace function public.settle_cash_payment_on_delivery()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'delivered' and new.payment_method = 'cash' then
    new.payment_status := 'paid';
    if new.cash_collected_at is null then
      new.cash_collected_at := now();
    end if;
    if new.payment_confirmed_at is null then
      new.payment_confirmed_at := now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists settle_cash_payment_on_delivery_trigger on public.orders;
create trigger settle_cash_payment_on_delivery_trigger
before insert or update on public.orders
for each row execute function public.settle_cash_payment_on_delivery();

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  title text,
  description text,
  discount_type text not null default 'percentage' check (discount_type in ('percentage', 'fixed', 'free_delivery')),
  discount_value numeric not null default 0,
  min_order numeric not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  usage_limit integer,
  times_used integer not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_email text,
  sender_role text check (sender_role in ('customer', 'restaurant', 'driver')),
  recipient_role text check (recipient_role in ('customer', 'restaurant', 'driver')),
  message text not null,
  read boolean not null default false,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  reporter_email text,
  reporter_role text check (reporter_role in ('customer', 'restaurant', 'driver')),
  category text not null check (category in ('customer_unreachable', 'wrong_address', 'missing_items', 'late_delivery', 'payment_issue', 'other')),
  description text not null,
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved')),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists restaurants_status_idx on public.restaurants(status);
create index if not exists menu_categories_restaurant_idx on public.menu_categories(restaurant_id);
create index if not exists menu_items_restaurant_idx on public.menu_items(restaurant_id);
create index if not exists orders_customer_idx on public.orders(customer_email);
create index if not exists orders_restaurant_idx on public.orders(restaurant_id);
create index if not exists orders_driver_idx on public.orders(driver_email);
create unique index if not exists orders_order_number_key on public.orders(order_number);
create unique index if not exists orders_customer_idempotency_key_idx on public.orders(customer_email, idempotency_key) where idempotency_key is not null;
create index if not exists orders_restaurant_status_created_desc_idx on public.orders(restaurant_id, status, created_date desc);
create index if not exists orders_restaurant_created_desc_idx on public.orders(restaurant_id, created_date desc);
create index if not exists orders_driver_status_updated_desc_idx on public.orders(driver_email, status, updated_date desc);
create index if not exists orders_driver_status_created_desc_idx on public.orders(driver_email, status, created_date desc);
create index if not exists orders_customer_created_desc_idx on public.orders(customer_email, created_date desc);
create index if not exists orders_created_desc_idx on public.orders(created_date desc);
create index if not exists orders_ready_unassigned_created_desc_idx on public.orders(created_date desc) where status = 'ready_for_pickup' and driver_email is null;
create index if not exists chat_messages_order_idx on public.chat_messages(order_id);
create index if not exists profiles_driver_approval_idx on public.profiles(driver_approval_status);

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_email text,
  actor_role text,
  action text not null,
  from_status text,
  to_status text,
  note text,
  created_date timestamptz not null default now()
);

create index if not exists order_status_events_order_idx on public.order_status_events(order_id);
create index if not exists order_status_events_order_created_desc_idx on public.order_status_events(order_id, created_date desc);

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

    select *
    into v_existing_order
    from public.orders
    where customer_email = p_customer_email
      and idempotency_key = v_idempotency_key
    limit 1;

    if found then
      return v_existing_order;
    end if;
  end if;

  if v_promo_code is not null then
    select *
    into v_promo
    from public.promotions
    where upper(code) = v_promo_code
      and (restaurant_id is null or restaurant_id = v_restaurant_id)
    order by
      case when restaurant_id = v_restaurant_id then 0 else 1 end,
      created_date desc,
      id
    limit 1;

    if not found then
      if exists (select 1 from public.promotions where upper(code) = v_promo_code) then
        raise exception 'PROMO_NOT_APPLICABLE' using errcode = 'P0001';
      end if;

      raise exception 'INVALID_PROMO_CODE' using errcode = 'P0001';
    end if;

    if not v_promo.is_active then
      raise exception 'INVALID_PROMO_CODE' using errcode = 'P0001';
    end if;

    if v_promo.starts_at is not null and v_promo.starts_at > v_now then
      raise exception 'PROMO_NOT_STARTED' using errcode = 'P0001';
    end if;

    if v_promo.ends_at is not null and v_promo.ends_at < v_now then
      raise exception 'PROMO_EXPIRED' using errcode = 'P0001';
    end if;

    if v_promo.usage_limit is not null and v_promo.times_used >= v_promo.usage_limit then
      raise exception 'PROMO_USAGE_LIMIT_REACHED' using errcode = 'P0001';
    end if;

    if v_promo.min_order is not null and v_subtotal < v_promo.min_order then
      raise exception 'PROMO_MIN_ORDER_NOT_MET' using errcode = 'P0001';
    end if;

    with promo_candidate as (
      select id
      from public.promotions
      where id = v_promo.id
        and is_active = true
        and (starts_at is null or starts_at <= v_now)
        and (ends_at is null or ends_at >= v_now)
        and (usage_limit is null or times_used < usage_limit)
        and (min_order is null or v_subtotal >= min_order)
      for update
    )
    update public.promotions promotion
    set
      times_used = promotion.times_used + 1,
      updated_date = v_now
    from promo_candidate
    where promotion.id = promo_candidate.id
    returning promotion.*
    into v_promo;

    if not found then
      raise exception 'PROMO_USAGE_LIMIT_REACHED' using errcode = 'P0001';
    end if;

    if v_promo.discount_type = 'free_delivery' then
      v_delivery_fee := 0;
      v_discount := 0;
    elsif v_promo.discount_type = 'percentage' then
      v_discount := least(round((v_subtotal * coalesce(v_promo.discount_value, 0)) / 100), v_subtotal);
    else
      v_discount := least(coalesce(v_promo.discount_value, 0), v_subtotal);
    end if;
  end if;

  v_total := greatest(0, v_subtotal + v_delivery_fee - v_discount);

  insert into public.orders (
    customer_email,
    customer_name,
    customer_phone,
    restaurant_id,
    restaurant_name,
    items,
    subtotal,
    delivery_fee,
    discount,
    total,
    promo_code,
    payment_method,
    payment_status,
    delivery_lat,
    delivery_lng,
    delivery_address_text,
    delivery_notes,
    is_scheduled,
    scheduled_for,
    status,
    accepted_at,
    idempotency_key,
    updated_date
  )
  values (
    p_customer_email,
    coalesce(nullif(btrim(p_customer_name), ''), p_customer_email),
    v_customer_phone,
    v_restaurant_id,
    v_restaurant_name,
    v_items,
    v_subtotal,
    v_delivery_fee,
    v_discount,
    v_total,
    v_promo_code,
    v_payment_method,
    v_payment_status,
    v_delivery_lat,
    v_delivery_lng,
    v_delivery_address_text,
    v_delivery_notes,
    v_is_scheduled,
    v_scheduled_for,
    'accepted',
    v_now,
    v_idempotency_key,
    v_now
  )
  returning *
  into v_order;

  update public.profiles
  set
    phone = v_customer_phone,
    default_lat = v_delivery_lat,
    default_lng = v_delivery_lng,
    default_address_text = v_delivery_address_text,
    updated_date = v_now
  where id = p_customer_id;

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
    v_order.id,
    p_customer_email,
    coalesce(nullif(btrim(p_actor_role), ''), 'customer'),
    'created_auto_accepted',
    null,
    'accepted',
    'Order created and accepted automatically'
  );

  return v_order;
end;
$$;

revoke all on function public.create_order_atomic(uuid, text, text, text, jsonb) from public;
revoke all on function public.create_order_atomic(uuid, text, text, text, jsonb) from anon;
revoke all on function public.create_order_atomic(uuid, text, text, text, jsonb) from authenticated;
grant execute on function public.create_order_atomic(uuid, text, text, text, jsonb) to service_role;

revoke all on function public.next_order_number() from public;
grant execute on function public.next_order_number() to service_role;
grant usage, select on sequence public.order_number_seq to service_role;

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

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '');
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    auth.jwt() -> 'user_metadata' ->> 'role',
    'user'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.can_manage_restaurant(target_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.restaurants r
      where r.id = target_restaurant_id
        and (
          r.owner_email = public.current_user_email()
          or r.id = (select p.restaurant_id from public.profiles p where p.id = auth.uid())
        )
    );
$$;

create or replace function public.can_access_order(target_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.orders o
      left join public.restaurants r on r.id = o.restaurant_id
      where o.id = target_order_id
        and (
          o.customer_email = public.current_user_email()
          or o.driver_email = public.current_user_email()
          or r.owner_email = public.current_user_email()
          or r.id = (select p.restaurant_id from public.profiles p where p.id = auth.uid())
        )
    );
$$;

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.promotions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.issue_reports enable row level security;
alter table public.order_status_events enable row level security;
alter table public.order_transition_rules enable row level security;

drop policy if exists "public restaurant read" on public.restaurants;
drop policy if exists "public menu category read" on public.menu_categories;
drop policy if exists "public menu item read" on public.menu_items;
drop policy if exists "authenticated profile read" on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "authenticated profile update" on public.profiles;
drop policy if exists "authenticated restaurant write" on public.restaurants;
drop policy if exists "authenticated menu category write" on public.menu_categories;
drop policy if exists "authenticated menu item write" on public.menu_items;
drop policy if exists "authenticated order access" on public.orders;
drop policy if exists "authenticated promotion access" on public.promotions;
drop policy if exists "authenticated chat access" on public.chat_messages;
drop policy if exists "authenticated issue access" on public.issue_reports;
drop policy if exists "profile read access" on public.profiles;
drop policy if exists "profile insert own row" on public.profiles;
drop policy if exists "profile update own row" on public.profiles;
drop policy if exists "profile delete admin only" on public.profiles;
drop policy if exists "restaurant read access" on public.restaurants;
drop policy if exists "restaurant insert admin only" on public.restaurants;
drop policy if exists "restaurant update managed restaurants" on public.restaurants;
drop policy if exists "restaurant delete admin only" on public.restaurants;
drop policy if exists "menu category read access" on public.menu_categories;
drop policy if exists "menu category write managed restaurants" on public.menu_categories;
drop policy if exists "menu item read access" on public.menu_items;
drop policy if exists "menu item write managed restaurants" on public.menu_items;
drop policy if exists "order read access" on public.orders;
drop policy if exists "order insert customer or admin" on public.orders;
drop policy if exists "order update participants" on public.orders;
drop policy if exists "order update admin only" on public.orders;
drop policy if exists "order delete admin only" on public.orders;
drop policy if exists "promotion read access" on public.promotions;
drop policy if exists "promotion write managed restaurants" on public.promotions;
drop policy if exists "chat read order participants" on public.chat_messages;
drop policy if exists "chat insert order participants" on public.chat_messages;
drop policy if exists "chat update order participants" on public.chat_messages;
drop policy if exists "chat delete admin only" on public.chat_messages;
drop policy if exists "issue read order participants" on public.issue_reports;
drop policy if exists "issue insert order participants" on public.issue_reports;
drop policy if exists "issue update restaurant driver admin" on public.issue_reports;
drop policy if exists "issue delete admin only" on public.issue_reports;
drop policy if exists "order event read participants" on public.order_status_events;
drop policy if exists "order event insert participants" on public.order_status_events;
drop policy if exists "order transition rules read authenticated" on public.order_transition_rules;

create policy "profile read access" on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
  or role = 'driver'
);

create policy "profile insert own row" on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profile update own row" on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
)
with check (
  id = auth.uid()
  or public.is_admin()
);

create policy "profile delete admin only" on public.profiles
for delete
to authenticated
using (public.is_admin());

create policy "restaurant read access" on public.restaurants
for select
using (
  status = 'approved'
  or public.can_manage_restaurant(id)
);

create policy "restaurant insert admin only" on public.restaurants
for insert
to authenticated
with check (public.is_admin());

create policy "restaurant update managed restaurants" on public.restaurants
for update
to authenticated
using (public.can_manage_restaurant(id))
with check (public.can_manage_restaurant(id));

create policy "restaurant delete admin only" on public.restaurants
for delete
to authenticated
using (public.is_admin());

create policy "menu category read access" on public.menu_categories
for select
using (
  exists (
    select 1
    from public.restaurants r
    where r.id = restaurant_id
      and (r.status = 'approved' or public.can_manage_restaurant(r.id))
  )
);

create policy "menu category write managed restaurants" on public.menu_categories
for all
to authenticated
using (public.can_manage_restaurant(restaurant_id))
with check (public.can_manage_restaurant(restaurant_id));

create policy "menu item read access" on public.menu_items
for select
using (
  exists (
    select 1
    from public.restaurants r
    where r.id = restaurant_id
      and (r.status = 'approved' or public.can_manage_restaurant(r.id))
  )
);

create policy "menu item write managed restaurants" on public.menu_items
for all
to authenticated
using (public.can_manage_restaurant(restaurant_id))
with check (public.can_manage_restaurant(restaurant_id));

create policy "order read access" on public.orders
for select
to authenticated
using (
  public.can_access_order(id)
  or (
    public.current_user_role() = 'driver'
    and status = 'ready_for_pickup'
    and driver_email is null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.driver_approval_status = 'approved'
        and p.driver_status = 'online'
    )
  )
);

create policy "order delete admin only" on public.orders
for delete
to authenticated
using (public.is_admin());

create policy "order event read participants" on public.order_status_events
for select
to authenticated
using (public.can_access_order(order_id));

create policy "promotion read access" on public.promotions
for select
using (
  (is_active = true)
  or public.is_admin()
  or (restaurant_id is not null and public.can_manage_restaurant(restaurant_id))
);

create policy "promotion write managed restaurants" on public.promotions
for all
to authenticated
using (
  public.is_admin()
  or (restaurant_id is not null and public.can_manage_restaurant(restaurant_id))
)
with check (
  public.is_admin()
  or (restaurant_id is not null and public.can_manage_restaurant(restaurant_id))
);

create policy "chat read order participants" on public.chat_messages
for select
to authenticated
using (public.can_access_order(order_id));

create policy "chat insert order participants" on public.chat_messages
for insert
to authenticated
with check (
  public.can_access_order(order_id)
  and sender_email = public.current_user_email()
);

create policy "chat update order participants" on public.chat_messages
for update
to authenticated
using (public.can_access_order(order_id))
with check (public.can_access_order(order_id));

create policy "chat delete admin only" on public.chat_messages
for delete
to authenticated
using (public.is_admin());

create policy "issue read order participants" on public.issue_reports
for select
to authenticated
using (
  public.is_admin()
  or reporter_email = public.current_user_email()
  or public.can_access_order(order_id)
);

create policy "issue insert order participants" on public.issue_reports
for insert
to authenticated
with check (
  reporter_email = public.current_user_email()
  and (
    order_id is null
    or public.can_access_order(order_id)
  )
);

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

create policy "issue delete admin only" on public.issue_reports
for delete
to authenticated
using (public.is_admin());

create policy "order transition rules read authenticated" on public.order_transition_rules
for select
to authenticated
using (true);

insert into storage.buckets (id, name, public)
values ('restaurant-assets', 'restaurant-assets', true)
on conflict (id) do nothing;

drop policy if exists "public asset read" on storage.objects;
drop policy if exists "authenticated asset upload" on storage.objects;
drop policy if exists "authenticated asset update" on storage.objects;
drop policy if exists "authenticated asset delete" on storage.objects;
drop policy if exists "restaurant asset read" on storage.objects;
drop policy if exists "restaurant asset upload" on storage.objects;
drop policy if exists "restaurant asset update" on storage.objects;
drop policy if exists "restaurant asset delete" on storage.objects;

create policy "public asset read" on storage.objects for select using (bucket_id = 'restaurant-assets');
create policy "authenticated asset upload" on storage.objects for insert to authenticated with check (bucket_id = 'restaurant-assets');
create policy "authenticated asset update" on storage.objects for update to authenticated using (bucket_id = 'restaurant-assets') with check (bucket_id = 'restaurant-assets');
create policy "authenticated asset delete" on storage.objects for delete to authenticated using (bucket_id = 'restaurant-assets');
