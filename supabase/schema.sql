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
  driver_vehicle_type text,
  driver_license_plate text,
  driver_rating numeric not null default 5,
  driver_total_deliveries integer not null default 0,
  driver_total_earnings numeric not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

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

alter table public.profiles enable row level security;
alter table public.restaurants enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.promotions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.issue_reports enable row level security;

create policy "public restaurant read" on public.restaurants for select using (status = 'approved' or auth.role() = 'authenticated');
create policy "public menu category read" on public.menu_categories for select using (true);
create policy "public menu item read" on public.menu_items for select using (true);
create policy "authenticated profile read" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "authenticated profile update" on public.profiles for update to authenticated using (true) with check (true);

create policy "authenticated restaurant write" on public.restaurants for all to authenticated using (true) with check (true);
create policy "authenticated menu category write" on public.menu_categories for all to authenticated using (true) with check (true);
create policy "authenticated menu item write" on public.menu_items for all to authenticated using (true) with check (true);
create policy "authenticated order access" on public.orders for all to authenticated using (true) with check (true);
create policy "authenticated promotion access" on public.promotions for all to authenticated using (true) with check (true);
create policy "authenticated chat access" on public.chat_messages for all to authenticated using (true) with check (true);
create policy "authenticated issue access" on public.issue_reports for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('restaurant-assets', 'restaurant-assets', true)
on conflict (id) do nothing;

create policy "public asset read" on storage.objects for select using (bucket_id = 'restaurant-assets');
create policy "authenticated asset upload" on storage.objects for insert to authenticated with check (bucket_id = 'restaurant-assets');
create policy "authenticated asset update" on storage.objects for update to authenticated using (bucket_id = 'restaurant-assets') with check (bucket_id = 'restaurant-assets');
create policy "authenticated asset delete" on storage.objects for delete to authenticated using (bucket_id = 'restaurant-assets');
