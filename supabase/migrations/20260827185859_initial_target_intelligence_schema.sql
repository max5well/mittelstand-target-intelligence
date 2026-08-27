-- Unternehmen target-intelligence schema. Public tables are workspace-scoped and RLS protected.
create extension if not exists pgcrypto;
create schema if not exists private;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Europe/Berlin',
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','analyst','viewer')),
  status text not null default 'invited' check (status in ('invited','active','suspended')),
  contact_fields_authorized boolean not null default false,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_memberships m
    where m.workspace_id = target_workspace_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function private.can_write_workspace(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_memberships m
    where m.workspace_id = target_workspace_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('admin','analyst')
  );
$$;

create or replace function private.is_workspace_admin(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_memberships m
    where m.workspace_id = target_workspace_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'admin'
  );
$$;

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.can_write_workspace(uuid) from public;
revoke all on function private.is_workspace_admin(uuid) from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function private.can_write_workspace(uuid) to authenticated, service_role;
grant execute on function private.is_workspace_admin(uuid) to authenticated, service_role;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  openregister_company_id text not null,
  legal_name text not null,
  legal_form text,
  register_number text,
  status text not null default 'new' check (status in ('new','reviewed','shortlisted','outreach_planned','contacted','in_conversation','nda','diligence','loi','passed','archived')),
  website_url text,
  purpose text,
  incorporation_date date,
  favorite_count integer not null default 0,
  hydration_stage text not null default 'discovered' check (hydration_stage in ('discovered','profiled','financials_complete','ownership_complete','web_enriched','people_enriched')),
  raw_provider_payload jsonb not null default '{}'::jsonb,
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, openregister_company_id)
);

create table public.company_names (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, name text not null, name_type text not null default 'legal', valid_from date, valid_to date, source_provider text not null, source_identifier text, retrieved_at timestamptz not null);
create table public.company_locations (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, address_line text, postcode text, city text, bundesland text, country_code text not null default 'DE', is_registered boolean not null default true, source_provider text not null, source_identifier text, retrieved_at timestamptz not null);
create table public.company_management (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, full_name text not null, role text not null, started_on date, ended_on date, source_provider text not null, source_identifier text, retrieved_at timestamptz not null, raw_payload jsonb not null default '{}'::jsonb);
create table public.company_financial_periods (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, fiscal_period_end date not null, consolidated boolean not null default false, currency text not null default 'EUR', revenue_cents bigint, ebitda_cents bigint, ebit_cents bigint, net_income_cents bigint, equity_cents bigint, cash_cents bigint, debt_cents bigint, total_assets_cents bigint, employees integer, source_provider text not null, source_identifier text, retrieved_at timestamptz not null, raw_payload jsonb not null default '{}'::jsonb, unique(company_id, fiscal_period_end, consolidated, source_provider));
create table public.company_owners (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, owner_name text not null, owner_type text, ownership_percent numeric(6,3), nominal_share_cents bigint, best_available boolean not null default false, source_provider text not null, source_identifier text, retrieved_at timestamptz not null, raw_payload jsonb not null default '{}'::jsonb);
create table public.company_ownership_classifications (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, classification text not null, classification_method text not null check (classification_method in ('openregister_flag','rules','ai_with_evidence','manual')), confidence numeric(4,3) not null check (confidence between 0 and 1), evidence jsonb not null default '[]'::jsonb, reviewed_by uuid references auth.users(id), reviewed_at timestamptz, is_current boolean not null default true, created_at timestamptz not null default now());
create table public.company_sources (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, provider text not null, source_identifier text, source_url text, source_date date, retrieved_at timestamptz not null, raw_payload jsonb not null default '{}'::jsonb);

create table public.tags (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, name text not null, color text, created_at timestamptz not null default now(), unique(workspace_id, name));
create table public.company_tags (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, tag_id uuid not null references public.tags(id) on delete cascade, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), unique(company_id, tag_id));
create table public.favorites (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique(company_id, user_id));

create table public.saved_searches (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, name text not null, description text, filters jsonb not null, plain_language_summary text not null, hydration_mode text not null check (hydration_mode in ('lean','full','custom')), hydration_stages text[] not null default '{}', daily_target integer not null default 40 check (daily_target between 1 and 100), schedule_time time, timezone text not null default 'Europe/Berlin', active boolean not null default false, page_cursor text, early_page_rescan_at timestamptz, monthly_credit_estimate bigint not null default 0, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.search_runs (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, saved_search_id uuid not null references public.saved_searches(id) on delete cascade, run_key text not null, scheduled_date date not null, status text not null check (status in ('queued','running','succeeded','failed','cancelled')), exact_filters jsonb not null, response_metadata jsonb not null default '{}'::jsonb, pages_scanned integer not null default 0, candidates_seen integer not null default 0, accepted_count integer not null default 0, credits_estimated bigint not null default 0, credits_used bigint, error_details jsonb, started_at timestamptz, completed_at timestamptz, unique(saved_search_id, run_key));
create table public.search_run_results (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, search_run_id uuid not null references public.search_runs(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, result_rank integer, accepted boolean not null, duplicate_reason text, raw_result jsonb not null default '{}'::jsonb, unique(search_run_id, company_id));

create table public.pipeline_events (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, from_status text, to_status text not null, changed_by uuid not null references auth.users(id), created_at timestamptz not null default now());
create table public.notes (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, body text not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.enrichment_jobs (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid references public.companies(id) on delete cascade, search_run_id uuid references public.search_runs(id) on delete cascade, provider text not null, job_type text not null, status text not null default 'queued' check (status in ('queued','running','succeeded','failed','retry_wait','cancelled','dead_letter')), idempotency_key text not null, payload jsonb not null default '{}'::jsonb, attempt_count integer not null default 0, max_attempts integer not null default 5, next_attempt_at timestamptz not null default now(), leased_by text, lease_expires_at timestamptz, heartbeat_at timestamptz, started_at timestamptz, completed_at timestamptz, error_details jsonb, estimated_credits bigint not null default 0, actual_credits bigint, created_at timestamptz not null default now(), unique(workspace_id, idempotency_key));
create table public.web_sources (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, provider text not null, query text, url text not null, title text, publication_date date, result_score numeric, supporting_excerpt text, retrieved_at timestamptz not null, raw_payload jsonb not null default '{}'::jsonb);
create table public.web_claims (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, claim_type text not null, claim_text text not null, confidence numeric(4,3) not null check (confidence between 0 and 1), source_ids uuid[] not null, model text not null, prompt_version text not null, schema_version text not null, token_usage jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.apollo_organizations (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, apollo_id text not null, domain text, country text, match_confidence numeric(4,3), estimated_employees integer, estimated_revenue_cents bigint, hierarchy jsonb not null default '{}'::jsonb, retrieved_at timestamptz not null, raw_payload jsonb not null default '{}'::jsonb, unique(workspace_id, apollo_id));
create table public.apollo_people (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, apollo_id text not null, full_name text not null, title text, linkedin_url text, personal_email_encrypted text, personal_phone_encrypted text, retrieved_at timestamptz not null, raw_payload jsonb not null default '{}'::jsonb, unique(workspace_id, apollo_id));
create table public.geocoding_results (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, address_hash text not null, provider text not null, latitude double precision, longitude double precision, match_quality text, status text not null check (status in ('matched','ambiguous','failed','manual')), manually_corrected_by uuid references auth.users(id), retrieved_at timestamptz not null, raw_payload jsonb not null default '{}'::jsonb, unique(company_id, address_hash));

create table public.score_configs (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, version integer not null, active boolean not null default false, weights jsonb not null, ranges jsonb not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), unique(workspace_id, version));
create table public.company_scores (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid not null references public.companies(id) on delete cascade, score_config_id uuid not null references public.score_configs(id), score integer check (score between 0 and 100), insufficient_data boolean not null default false, components jsonb not null, reasons jsonb not null, calculated_at timestamptz not null default now(), unique(company_id, score_config_id));
create table public.provider_usage_events (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, provider text not null, endpoint text not null, enrichment_job_id uuid references public.enrichment_jobs(id), estimated_credits bigint not null default 0, actual_credits bigint, estimated_cost_cents bigint, request_count integer not null default 1, http_status integer, duration_ms integer, occurred_at timestamptz not null default now());
create table public.audit_logs (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, actor_user_id uuid references auth.users(id), action text not null, entity_type text not null, entity_id uuid, changes jsonb not null default '{}'::jsonb, ip_hash text, user_agent_redacted text, occurred_at timestamptz not null default now());
create table public.saved_views (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, name text not null, filters jsonb not null default '{}'::jsonb, sorting jsonb not null default '[]'::jsonb, columns jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique(workspace_id, user_id, name));
create table public.suppression_entries (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, company_id uuid references public.companies(id) on delete cascade, normalized_value_hash text not null, suppression_type text not null, reason text, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), unique(workspace_id, normalized_value_hash, suppression_type));

create index companies_workspace_name_idx on public.companies(workspace_id, legal_name);
create index companies_external_id_idx on public.companies(openregister_company_id);
create index companies_workspace_status_idx on public.companies(workspace_id, status);
create index company_names_search_idx on public.company_names using gin (to_tsvector('german', name));
create index company_locations_workspace_state_city_idx on public.company_locations(workspace_id, bundesland, city);
create index company_financials_workspace_revenue_idx on public.company_financial_periods(workspace_id, revenue_cents desc nulls last);
create index company_financials_company_period_idx on public.company_financial_periods(company_id, fiscal_period_end desc);
create index company_tags_company_idx on public.company_tags(company_id);
create index favorites_user_idx on public.favorites(workspace_id, user_id, company_id);
create index search_results_company_idx on public.search_run_results(company_id, search_run_id);
create index jobs_claim_idx on public.enrichment_jobs(status, next_attempt_at, lease_expires_at);
create index jobs_workspace_created_idx on public.enrichment_jobs(workspace_id, created_at desc);
create index usage_workspace_time_idx on public.provider_usage_events(workspace_id, occurred_at desc);
create index audit_workspace_time_idx on public.audit_logs(workspace_id, occurred_at desc);

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_memberships enable row level security;

create policy workspaces_select on public.workspaces for select to authenticated using ((select private.is_workspace_member(id)));
create policy workspaces_update on public.workspaces for update to authenticated using ((select private.is_workspace_admin(id))) with check ((select private.is_workspace_admin(id)));
create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy memberships_select on public.workspace_memberships for select to authenticated using ((select private.is_workspace_member(workspace_id)));
create policy memberships_insert on public.workspace_memberships for insert to authenticated with check ((select private.is_workspace_admin(workspace_id)));
create policy memberships_update on public.workspace_memberships for update to authenticated using ((select private.is_workspace_admin(workspace_id))) with check ((select private.is_workspace_admin(workspace_id)));
create policy memberships_delete on public.workspace_memberships for delete to authenticated using ((select private.is_workspace_admin(workspace_id)));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'companies','company_names','company_locations','company_management','company_financial_periods','company_owners','company_ownership_classifications','company_sources',
    'tags','company_tags','favorites','saved_searches','search_runs','search_run_results','pipeline_events','notes','enrichment_jobs','web_sources','web_claims',
    'apollo_organizations','apollo_people','geocoding_results','score_configs','company_scores','provider_usage_events','audit_logs','saved_views','suppression_entries'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_workspace_member(workspace_id)))', table_name || '_select', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.can_write_workspace(workspace_id)))', table_name || '_insert', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.can_write_workspace(workspace_id))) with check ((select private.can_write_workspace(workspace_id)))', table_name || '_update', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.can_write_workspace(workspace_id)))', table_name || '_delete', table_name);
  end loop;
end $$;

create or replace function private.claim_enrichment_job(target_workspace_id uuid, worker_identifier text, lease_seconds integer default 60)
returns public.enrichment_jobs language plpgsql security definer set search_path = '' as $$
declare claimed public.enrichment_jobs;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not private.can_write_workspace(target_workspace_id) then
    raise exception 'not authorized';
  end if;
  update public.enrichment_jobs
    set status = 'running', leased_by = worker_identifier,
        lease_expires_at = now() + make_interval(secs => lease_seconds),
        heartbeat_at = now(), started_at = coalesce(started_at, now()),
        attempt_count = attempt_count + 1
  where id = (
    select id from public.enrichment_jobs
    where workspace_id = target_workspace_id
      and status in ('queued','retry_wait') and next_attempt_at <= now()
      and (lease_expires_at is null or lease_expires_at < now())
    order by next_attempt_at, created_at for update skip locked limit 1
  ) returning * into claimed;
  return claimed;
end;
$$;
revoke all on function private.claim_enrichment_job(uuid,text,integer) from public;
grant execute on function private.claim_enrichment_job(uuid,text,integer) to authenticated, service_role;

drop policy audit_logs_update on public.audit_logs;
drop policy audit_logs_delete on public.audit_logs;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

create view public.workspace_company_metrics with (security_invoker = true) as
select workspace_id, count(*) as company_count,
  count(*) filter (where status = 'shortlisted') as shortlisted_count,
  count(*) filter (where status in ('contacted','in_conversation','nda','diligence','loi')) as active_dialogue_count,
  count(*) filter (where website_url is not null) as website_count
from public.companies group by workspace_id;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
