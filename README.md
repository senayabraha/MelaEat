# MelaEat

Next.js + React food delivery app prepared for Vercel and Supabase.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=restaurant-assets
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

3. Run the SQL in `sql/schema.sql` in your Supabase SQL editor.

4. Run locally:

```bash
npm run dev
```

## Vercel

Add the same `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`, and `SUPABASE_SERVICE_ROLE_KEY` values in Vercel Project Settings -> Environment Variables.

The app now runs on Next.js and deploys natively on Vercel.

## Supabase Auth

The app uses normal email/password sign in and sign up at `/login`.

If email confirmation is enabled in Supabase Auth, make sure your local and production URLs are added to the allowed redirect URLs, for example:

```text
http://localhost:3000/**
https://your-vercel-domain.vercel.app/**
```

## Server Routes

The app uses `SUPABASE_SERVICE_ROLE_KEY` only on the server for privileged flows such as:

- `POST /api/orders` to validate cart pricing, promos, restaurant availability, auto-accept orders, and create audit events
- `POST /api/orders/:id/action` to move order status, cancel eligible orders, assign drivers, and settle cash payments on delivery
- `POST /api/restaurant/setup` to create and link a restaurant profile for a restaurant owner
- `POST /api/orders/:id/rate` to save customer ratings and refresh restaurant/driver aggregates

## Production Checklist

- Run the latest `sql/schema.sql` in Supabase SQL editor after pulling changes.
- Confirm `order_status_events`, cash payment fields, and order triggers exist in Supabase.
- Confirm Storage has the `restaurant-assets` public bucket.
- Confirm Vercel has all four environment variables from `.env.example`.
- Place a test cash order and verify it starts as `cash_on_delivery`, then becomes `paid` when the driver marks it delivered.
- Place a test card or Telebirr order and verify it starts as `paid`.
- Verify restaurant owners see active auto-accepted orders and can set prep estimates.
