insert into public.workspaces (id, name, timezone)
values ('00000000-0000-4000-8000-000000000010', 'DACH Industrials I', 'Europe/Berlin')
on conflict (id) do update set
  name = excluded.name,
  timezone = excluded.timezone,
  updated_at = now();
