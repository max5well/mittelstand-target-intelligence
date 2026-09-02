-- Only the two explicitly approved Google identities may create an Auth user.
create or replace function private.restrict_google_signup(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  requested_email text := lower(btrim(event -> 'user' ->> 'email'));
  requested_provider text := event -> 'user' -> 'app_metadata' ->> 'provider';
begin
  if requested_email in (
    'wiese@dge.technology',
    'leonhardt@dge.technology'
  ) and requested_provider = 'google' then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'This Google account is not approved for this application.'
    )
  );
end;
$$;

grant usage on schema private to supabase_auth_admin;
grant execute on function private.restrict_google_signup(jsonb) to supabase_auth_admin;
revoke execute on function private.restrict_google_signup(jsonb)
  from public, anon, authenticated;

-- Approved users receive normal read/write workspace access. The analyst role
-- deliberately avoids the separate administrator TOTP requirement.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  if lower(btrim(new.email)) in (
    'wiese@dge.technology',
    'leonhardt@dge.technology'
  ) and new.raw_app_meta_data ->> 'provider' = 'google' then
    insert into public.workspace_memberships (
      workspace_id,
      user_id,
      role,
      status
    )
    values (
      '00000000-0000-4000-8000-000000000010',
      new.id,
      'analyst',
      'active'
    )
    on conflict (workspace_id, user_id) do update
      set status = 'active';
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

-- Also cover an approved Google identity that might predate this migration.
insert into public.workspace_memberships (workspace_id, user_id, role, status)
select
  '00000000-0000-4000-8000-000000000010',
  users.id,
  'analyst',
  'active'
from auth.users as users
where lower(btrim(users.email)) in (
  'wiese@dge.technology',
  'leonhardt@dge.technology'
)
and users.raw_app_meta_data ->> 'provider' = 'google'
on conflict (workspace_id, user_id) do update
  set status = 'active';
