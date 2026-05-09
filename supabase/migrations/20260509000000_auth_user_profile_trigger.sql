-- Auto-create a profile row whenever a new auth.users row is inserted.
-- The role is forced to 'user' here; the real role is set by the
-- /api/profile/complete-role endpoint after the user picks one in the UI.
-- This blocks privilege escalation via crafted user_metadata.role values.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1),
      'User'
    ),
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Harden profile inserts from the client: never accept admin/role escalation.
-- The "profile insert own row" policy is still id = auth.uid(), but we add a
-- column-level constraint via a trigger so only role='user' is allowed for
-- self-inserts. service_role and admins (via complete-role API) bypass.
create or replace function public.prevent_profile_role_escalation_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from 'user' then
    new.role := 'user';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_role_escalation_on_insert_trigger on public.profiles;
create trigger prevent_profile_role_escalation_on_insert_trigger
before insert on public.profiles
for each row execute function public.prevent_profile_role_escalation_on_insert();
