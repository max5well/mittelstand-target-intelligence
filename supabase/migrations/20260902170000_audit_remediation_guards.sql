-- Audit F-05/F-07: enforce one active paid action per company/provider/stage
-- and keep OpenRegister ownership shares in their documented 0..1 unit.

update public.enrichment_jobs
set status = 'failed',
    completed_at = coalesce(completed_at, now()),
    error_details = coalesce(error_details, '{}'::jsonb) ||
      '{"message":"Recovered stale job during concurrency-guard migration"}'::jsonb
where status = 'running'
  and (lease_expires_at is null or lease_expires_at < now());

with duplicate_running as (
  select id,
         row_number() over (
           partition by workspace_id, company_id, provider, job_type
           order by started_at desc nulls last, created_at desc
         ) as position
  from public.enrichment_jobs
  where status = 'running' and company_id is not null
)
update public.enrichment_jobs jobs
set status = 'cancelled',
    completed_at = now(),
    error_details = '{"message":"Superseded by concurrent active job"}'::jsonb
from duplicate_running duplicates
where jobs.id = duplicates.id and duplicates.position > 1;

create unique index if not exists enrichment_jobs_one_running_action_idx
  on public.enrichment_jobs (workspace_id, company_id, provider, job_type)
  where status = 'running' and company_id is not null;

-- Legacy seed/import rows stored whole percentages (10..100). New provider
-- ingestion stores OpenRegister's documented fraction (0..1).
update public.company_owners
set ownership_percent = ownership_percent / 100
where ownership_percent > 1 and ownership_percent <= 100;

alter table public.company_owners
  add constraint company_owners_ownership_percent_fraction_check
  check (ownership_percent is null or ownership_percent between 0 and 1)
  not valid;

alter table public.company_owners
  validate constraint company_owners_ownership_percent_fraction_check;
