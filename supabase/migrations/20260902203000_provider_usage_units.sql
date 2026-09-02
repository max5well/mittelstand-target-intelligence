alter table public.provider_usage_events
  add column if not exists usage_unit text not null default 'provider_credits',
  add column if not exists estimated_units bigint,
  add column if not exists actual_units bigint,
  add column if not exists input_units bigint,
  add column if not exists output_units bigint,
  add column if not exists actual_cost_micros bigint;

alter table public.provider_usage_events
  drop constraint if exists provider_usage_events_usage_unit_check;

alter table public.provider_usage_events
  add constraint provider_usage_events_usage_unit_check
  check (usage_unit in ('provider_credits', 'tokens'));

alter table public.provider_usage_events
  drop constraint if exists provider_usage_events_units_nonnegative_check;

alter table public.provider_usage_events
  add constraint provider_usage_events_units_nonnegative_check
  check (
    coalesce(estimated_units, 0) >= 0 and
    coalesce(actual_units, 0) >= 0 and
    coalesce(input_units, 0) >= 0 and
    coalesce(output_units, 0) >= 0 and
    coalesce(actual_cost_micros, 0) >= 0
  );
