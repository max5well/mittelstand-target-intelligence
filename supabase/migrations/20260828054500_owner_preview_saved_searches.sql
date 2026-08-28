-- Sites owner-only access is enforced by the hosting layer. Until Supabase Auth
-- is enabled for the workspace, saved searches may be created without an
-- auth.users foreign-key author.
alter table public.saved_searches alter column created_by drop not null;
