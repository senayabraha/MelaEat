create extension if not exists "pgcrypto";

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
  order_number text,
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
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  delivery_lat numeric,
  delivery_lng numeric,
  delivery_address_text text,
  delivery_notes text,
  scheduled_for timestamptz,
  is_scheduled boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'preparing', 'ready_for_pickup', 'picked_up', 'on_the_way', 'delivered', 'cancelled')),
  rejection_reason text,
  estimated_ready_at timestamptz,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  customer_rating_restaurant numeric,
  customer_rating_driver numeric,
  customer_review text,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

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
create index if not exists chat_messages_order_idx on public.chat_messages(order_id);
create index if not exists profiles_driver_approval_idx on public.profiles(driver_approval_status);

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

create policy "order insert customer or admin" on public.orders
for insert
to authenticated
with check (
  public.is_admin()
  or customer_email = public.current_user_email()
);

create policy "order update admin only" on public.orders
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "order delete admin only" on public.orders
for delete
to authenticated
using (public.is_admin());

create policy "promotion read access" on public.promotions
for select
using (
  is_active = true
  or restaurant_id is null
  or public.can_manage_restaurant(restaurant_id)
  or public.is_admin()
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
  or order_id is null
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
  or (order_id is not null and public.can_access_order(order_id))
)
with check (
  public.is_admin()
  or (order_id is not null and public.can_access_order(order_id))
);

create policy "issue delete admin only" on public.issue_reports
for delete
to authenticated
using (public.is_admin());

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
