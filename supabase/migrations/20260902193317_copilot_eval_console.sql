-- Persistent Copilot research traces and an owner-only evaluation workspace.
-- Product research data remains workspace-scoped. Evaluation configuration and
-- human review are additionally restricted to the designated evaluator.

create or replace function private.is_eval_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where id = (select auth.uid())
      and lower(email) = 'wiese@dge.technology'
  );
$$;

revoke all on function private.is_eval_admin() from public;
grant execute on function private.is_eval_admin() to authenticated;

create table public.copilot_research_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete restrict,
  user_question text not null,
  requested_mode text not null check (requested_mode in ('auto', 'quick', 'deep')),
  resolved_mode text check (resolved_mode in ('quick', 'standard', 'deep')),
  answer_length text check (answer_length in ('concise', 'explained', 'report')),
  task_types text[] not null default '{}',
  task_taxonomy_version text not null default 'copilot-task-v1',
  classification_confidence numeric(4,3) check (classification_confidence between 0 and 1),
  status text not null default 'queued' check (
    status in ('queued', 'planning', 'researching', 'synthesizing', 'completed', 'failed', 'cancelled')
  ),
  answer text,
  answer_payload jsonb not null default '{}'::jsonb,
  model_route jsonb not null default '{}'::jsonb,
  token_usage jsonb not null default '{}'::jsonb,
  estimated_cost_micros bigint,
  latency_ms integer,
  error_details jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.copilot_trace_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  research_run_id uuid not null references public.copilot_research_runs(id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  event_type text not null,
  prompt_template text,
  prompt_version text,
  model text,
  provider text,
  input_snapshot jsonb not null default '{}'::jsonb,
  output_snapshot jsonb not null default '{}'::jsonb,
  input_hash text,
  token_usage jsonb not null default '{}'::jsonb,
  estimated_cost_micros bigint,
  duration_ms integer,
  error_details jsonb,
  created_at timestamptz not null default now(),
  unique (research_run_id, sequence)
);

create table public.copilot_search_queries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  research_run_id uuid not null references public.copilot_research_runs(id) on delete cascade,
  tool text not null,
  purpose text,
  query text not null,
  result_count integer,
  accepted_count integer,
  rejected_count integer,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table public.copilot_research_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  research_run_id uuid not null references public.copilot_research_runs(id) on delete cascade,
  provider text not null,
  source_type text,
  url text not null,
  canonical_url text not null,
  title text,
  decision text not null check (decision in ('candidate', 'accepted', 'rejected')),
  rejection_reason text,
  relevant_excerpt text,
  retrieved_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (research_run_id, canonical_url)
);

create table public.copilot_research_claims (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  research_run_id uuid not null references public.copilot_research_runs(id) on delete cascade,
  source_id uuid references public.copilot_research_sources(id) on delete set null,
  claim_type text not null,
  claim_text text not null,
  support_status text not null check (support_status in ('supported', 'conflicted', 'insufficient')),
  confidence numeric(4,3) check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);

create table public.copilot_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  research_run_id uuid not null references public.copilot_research_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  helpful boolean,
  saved_to_dossier boolean not null default false,
  comment text,
  created_at timestamptz not null default now(),
  unique (research_run_id, user_id)
);

create table public.eval_datasets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create table public.eval_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dataset_id uuid not null references public.eval_datasets(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  source_run_id uuid references public.copilot_research_runs(id) on delete set null,
  question text not null,
  research_mode text not null check (research_mode in ('auto', 'quick', 'deep')),
  rubric jsonb not null default '{}'::jsonb,
  expected_behaviors jsonb not null default '[]'::jsonb,
  critical_failures jsonb not null default '[]'::jsonb,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.eval_experiments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  dataset_id uuid not null references public.eval_datasets(id) on delete cascade,
  name text not null,
  description text,
  baseline_config jsonb not null default '{}'::jsonb,
  candidate_config jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'running', 'completed', 'failed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.eval_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  experiment_id uuid references public.eval_experiments(id) on delete cascade,
  eval_case_id uuid references public.eval_cases(id) on delete cascade,
  research_run_id uuid references public.copilot_research_runs(id) on delete set null,
  stage text not null,
  evaluator_type text not null check (evaluator_type in ('deterministic', 'llm', 'human')),
  evaluator_model text,
  rubric_version text not null default 'eval-rub-v1',
  verdict text check (verdict in ('pass', 'partial', 'fail', 'not_applicable')),
  scores jsonb not null default '{}'::jsonb,
  reasoning text,
  reviewed_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index copilot_runs_workspace_created_idx
  on public.copilot_research_runs (workspace_id, created_at desc);
create index copilot_runs_task_types_idx
  on public.copilot_research_runs using gin (task_types);
create index copilot_trace_run_sequence_idx
  on public.copilot_trace_events (research_run_id, sequence);
create index copilot_queries_run_idx
  on public.copilot_search_queries (research_run_id, created_at);
create index copilot_sources_run_decision_idx
  on public.copilot_research_sources (research_run_id, decision);
create index eval_cases_dataset_idx
  on public.eval_cases (dataset_id, created_at desc);
create unique index eval_cases_dataset_source_run_uidx
  on public.eval_cases (dataset_id, source_run_id)
  where source_run_id is not null;
create index eval_results_run_stage_idx
  on public.eval_results (research_run_id, stage, created_at desc);

alter table public.copilot_research_runs enable row level security;
alter table public.copilot_trace_events enable row level security;
alter table public.copilot_search_queries enable row level security;
alter table public.copilot_research_sources enable row level security;
alter table public.copilot_research_claims enable row level security;
alter table public.copilot_feedback enable row level security;
alter table public.eval_datasets enable row level security;
alter table public.eval_cases enable row level security;
alter table public.eval_experiments enable row level security;
alter table public.eval_results enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'copilot_research_runs',
    'copilot_trace_events',
    'copilot_search_queries',
    'copilot_research_sources',
    'copilot_research_claims',
    'copilot_feedback'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_workspace_member(workspace_id)))',
      table_name || '_select', table_name
    );
  end loop;

  foreach table_name in array array[
    'eval_datasets',
    'eval_cases',
    'eval_experiments',
    'eval_results'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_workspace_member(workspace_id)) and (select private.is_eval_admin()))',
      table_name || '_eval_select', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_workspace_member(workspace_id)) and (select private.is_eval_admin()))',
      table_name || '_eval_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_workspace_member(workspace_id)) and (select private.is_eval_admin())) with check ((select private.is_workspace_member(workspace_id)) and (select private.is_eval_admin()))',
      table_name || '_eval_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.is_workspace_member(workspace_id)) and (select private.is_eval_admin()))',
      table_name || '_eval_delete', table_name
    );
  end loop;
end $$;

grant select on table
  public.copilot_research_runs,
  public.copilot_trace_events,
  public.copilot_search_queries,
  public.copilot_research_sources,
  public.copilot_research_claims,
  public.copilot_feedback
to authenticated;

grant select, insert, update, delete on table
  public.eval_datasets,
  public.eval_cases,
  public.eval_experiments,
  public.eval_results
to authenticated;
