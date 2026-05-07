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
```

3. Run the SQL in `supabase/schema.sql` in your Supabase SQL editor.

4. Run locally:

```bash
npm run dev
```

## Vercel

Add the same `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` values in Vercel Project Settings -> Environment Variables.

The app now runs on Next.js and deploys natively on Vercel.

## Supabase Auth

The app uses email magic links at `/login`. In Supabase Auth settings, add your local and production URLs to the allowed redirect URLs, for example:

```text
http://localhost:3000/**
https://your-vercel-domain.vercel.app/**
```
