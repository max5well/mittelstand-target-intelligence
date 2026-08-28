alter table public.provider_usage_events
  drop constraint if exists provider_usage_events_enrichment_job_id_fkey;

alter table public.provider_usage_events
  add constraint provider_usage_events_enrichment_job_id_fkey
  foreign key (enrichment_job_id)
  references public.enrichment_jobs(id)
  on delete set null;
