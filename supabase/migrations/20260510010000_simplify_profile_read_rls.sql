-- Login was hanging for all roles because the previous "profile read access"
-- policy evaluated an EXISTS subquery against orders + can_access_order() on
-- every row scan, which made the post-sign-in `select * from profiles` either
-- time out or return errors that the client surfaced as a stuck spinner.
--
-- Drop driver-row visibility from the SELECT policy. Drivers only need to see
-- their own row to log in; cross-driver visibility (for assigned orders) can
-- be re-introduced later via a dedicated, non-blocking path if needed.

drop policy if exists "profile read access" on public.profiles;

create policy "profile read access" on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
);
