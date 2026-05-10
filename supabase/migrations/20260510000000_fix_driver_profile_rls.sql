-- Scope driver profile visibility to orders the current user can access.
-- Before: any authenticated user could read ALL driver profile rows via
-- the bare "or role = 'driver'" condition, leaking phone numbers, vehicle
-- details, license plates, and earnings.
-- After: a driver row is only readable when that driver is assigned to an
-- order the requesting user already has access to (via can_access_order).

drop policy if exists "profile read access" on public.profiles;

create policy "profile read access" on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
  or (
    role = 'driver'
    and exists (
      select 1 from public.orders o
      where o.driver_id = profiles.id
      and public.can_access_order(o.id)
    )
  )
);
