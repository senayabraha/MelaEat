# MelaEat

Vite + React food delivery app prepared for Vercel and Supabase.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_STORAGE_BUCKET=restaurant-assets
```

3. Run the SQL in `supabase/schema.sql` in your Supabase SQL editor.

4. Run locally:

```bash
npm run dev
```

## Vercel

Add the same `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SUPABASE_STORAGE_BUCKET` values in Vercel Project Settings -> Environment Variables.

The app is a Vite SPA. `vercel.json` rewrites all routes to `index.html` so React Router works after deployment.

## Supabase Auth

The app uses email magic links at `/login`. In Supabase Auth settings, add your local and production URLs to the allowed redirect URLs, for example:

```text
http://localhost:5173/**
https://your-vercel-domain.vercel.app/**
```
