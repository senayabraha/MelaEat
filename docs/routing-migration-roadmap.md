# Routing Migration Roadmap

The app currently mounts the React Router SPA through `src/app/[[...slug]]/page.jsx`. Keep that catch-all until each route group has parity in Next App Router.

## Route Map

| Current React Router path | Proposed Next route | Risk | Notes |
| --- | --- | --- | --- |
| `/` | `src/app/page.jsx` | Low | Public landing page. First candidate. |
| `/browse` | `src/app/browse/page.jsx` | Low-Medium | Public restaurant list; can keep client data initially. |
| `/restaurant/:id` | `src/app/restaurant/[id]/page.jsx` | Medium | SEO value; eventually server-render approved restaurant/menu data. |
| `/login/:role`, `/signup/:role`, `/reset-password/:role?` | `src/app/(auth)/...` | Medium | Auth callback edge cases; migrate after route tests. |
| `/cart`, `/checkout` | `src/app/(customer)/...` | Medium | Client cart state; keep client components at first. |
| `/orders`, `/order/:id`, `/favorites`, `/profile`, `/addresses` | `src/app/(customer)/...` | Medium | Protected customer shell. |
| `/restaurant/*` dashboard | `src/app/restaurant/(dashboard)/...` | High | Auth and data loading heavy; migrate after public parity. |
| `/driver/*` dashboard | `src/app/driver/(dashboard)/...` | High | Realtime queues and role state. |
| `/admin/*` dashboard | `src/app/admin/...` | High | Broad RLS/admin surface. |

## Milestones

1. Public shell branch: move `/` and `/browse`, keep React Router catch-all for everything else.
2. Restaurant SEO branch: move `/restaurant/[id]` with parity screenshots and menu/favorite behavior preserved.
3. Auth branch: move login/signup/reset routes and verify Supabase recovery callbacks.
4. Customer protected branch: move customer account/order routes behind a Next layout.
5. Dashboard branch: migrate restaurant, driver, then admin dashboards one role at a time.
6. Decommission branch: remove `[[...slug]]`, `react-router-dom`, and SPA-only route wrappers after parity.

## Compatibility Plan

- Keep `[[...slug]]/page.jsx` until the final branch.
- New Next routes should land route-by-route and take precedence over the catch-all.
- Shared data clients and UI components should remain import-compatible during migration.
- Each branch should include a route parity checklist and screenshots for desktop/mobile.

