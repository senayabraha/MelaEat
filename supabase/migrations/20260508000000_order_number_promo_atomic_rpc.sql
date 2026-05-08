begin;

create sequence if not exists public.order_number_seq;

create or replace function public.next_order_number()
returns text
language sql
volatile
as $$
  select 'ME-' || lpad(nextval('public.order_number_seq')::text, 10, '0');
$$;

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

create unique index if not exists orders_order_number_key
on public.orders(order_number);

alter table public.orders
add column if not exists idempotency_key text;

create unique index if not exists orders_customer_idempotency_key_idx
on public.orders(customer_email, idempotency_key)
where idempotency_key is not null;

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

commit;
