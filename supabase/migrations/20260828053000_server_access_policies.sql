-- Server-only access for the private Sites deployment. The browser-facing
-- publishable key remains subject to RLS and cannot read workspace data.
create table private.backend_access_tokens (
  id text primary key,
  token_hash text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

revoke all on table private.backend_access_tokens from public, anon, authenticated;

create or replace function private.has_backend_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.backend_access_tokens token
    where token.enabled
      and token.token_hash = encode(
        extensions.digest(
          coalesce(
            current_setting('request.headers', true)::jsonb ->> 'x-app-backend-token',
            ''
          ),
          'sha256'
        ),
        'hex'
      )
  );
$$;

revoke all on function private.has_backend_access() from public;
grant execute on function private.has_backend_access() to anon;

grant select, update on public.workspaces to anon;
create policy workspaces_backend_select on public.workspaces
  for select to anon using ((select private.has_backend_access()));
create policy workspaces_backend_update on public.workspaces
  for update to anon using ((select private.has_backend_access()))
  with check ((select private.has_backend_access()));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'companies','company_names','company_locations','company_management',
    'company_financial_periods','company_owners','company_ownership_classifications',
    'company_sources','tags','company_tags','favorites','saved_searches','search_runs',
    'search_run_results','pipeline_events','notes','enrichment_jobs','web_sources',
    'web_claims','apollo_organizations','apollo_people','geocoding_results','score_configs',
    'company_scores','provider_usage_events','audit_logs','saved_views','suppression_entries'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to anon', table_name);
    execute format(
      'create policy %I on public.%I for select to anon using ((select private.has_backend_access()))',
      table_name || '_backend_select', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to anon with check ((select private.has_backend_access()))',
      table_name || '_backend_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to anon using ((select private.has_backend_access())) with check ((select private.has_backend_access()))',
      table_name || '_backend_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to anon using ((select private.has_backend_access()))',
      table_name || '_backend_delete', table_name
    );
  end loop;
end $$;
