-- FICTIONAL DEMONSTRATION DATA. No row below represents a real company or person.
insert into public.workspaces (id, name, timezone)
values ('00000000-0000-4000-8000-000000000010', 'DACH Industrials I', 'Europe/Berlin')
on conflict (id) do nothing;

with fixture_data as (
  select
    n,
    (array['Hanseatic','Rheinwerk','Bergmann','Nordlicht','Mainbogen','Alpenkraft','Elbtal','Schwarzwald','Westfalen','Isar','Havel','Taunus'])[1 + ((n - 1) % 12)]
      || ' ' ||
    (array['Präzisionstechnik','Automationssysteme','Medizintechnik','Gebäudetechnik','Verpackungstechnik','Dosiersysteme'])[1 + ((n - 1) % 6)]
      || case when n % 4 = 0 then ' AG' else ' GmbH' end as legal_name,
    (array['GmbH','GmbH','GmbH','AG'])[1 + ((n - 1) % 4)] as legal_form,
    (array['new','reviewed','shortlisted','contacted','in_conversation','nda','diligence','passed'])[1 + ((n - 1) % 8)] as pipeline_status
  from generate_series(1, 48) n
)
insert into public.companies (
  id, workspace_id, openregister_company_id, legal_name, legal_form,
  register_number, status, website_url, hydration_stage, raw_provider_payload,
  discovered_at, updated_at
)
select
  ('10000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  '00000000-0000-4000-8000-000000000010'::uuid,
  'or_mock_' || (18000 + n), legal_name, legal_form,
  'HRB MOCK ' || (40000 + n), pipeline_status,
  case when n % 13 = 0 then null else 'https://fictional-target-' || n || '.example' end,
  case when n % 5 = 0 then 'profiled' else 'ownership_complete' end,
  jsonb_build_object('fixture', true, 'fictional', true, 'seed_version', 1),
  now() - make_interval(days => (n % 30)), now() - make_interval(days => (n % 45))
from fixture_data
on conflict (workspace_id, openregister_company_id) do nothing;

insert into public.company_financial_periods (
  workspace_id, company_id, fiscal_period_end, consolidated, currency,
  revenue_cents, ebitda_cents, ebit_cents, net_income_cents, employees,
  source_provider, source_identifier, retrieved_at, raw_payload
)
select
  c.workspace_id, c.id, make_date(2024 - y.offset, 12, 31), false, 'EUR',
  case when right(c.openregister_company_id, 1) = '9' then null else 1500000000 + (y.offset * -120000000) + (row_number() over ())::bigint * 17000000 end,
  case when right(c.openregister_company_id, 1) = '9' then null else 240000000 + (y.offset * -20000000) end,
  190000000 + (y.offset * -18000000), 110000000 + (y.offset * -10000000),
  50 + ((row_number() over ())::integer % 290),
  'openregister', 'fictional-financial-' || y.offset, now() - interval '14 days',
  jsonb_build_object('fixture', true, 'fictional', true)
from public.companies c cross join (values (0),(1),(2)) y(offset)
where c.workspace_id = '00000000-0000-4000-8000-000000000010';

insert into public.geocoding_results (
  workspace_id, company_id, address_hash, provider, latitude, longitude,
  match_quality, status, retrieved_at, raw_payload
)
select workspace_id, id, encode(digest(legal_name, 'sha256'), 'hex'), 'mock-geocoder',
  case when openregister_company_id = 'or_mock_18029' then null else 47.8 + (random() * 7) end,
  case when openregister_company_id = 'or_mock_18029' then null else 6.2 + (random() * 8.5) end,
  case when openregister_company_id = 'or_mock_18029' then 'ambiguous' else 'rooftop' end,
  case when openregister_company_id = 'or_mock_18029' then 'ambiguous' else 'matched' end,
  now(), jsonb_build_object('fixture', true, 'fictional', true)
from public.companies where workspace_id = '00000000-0000-4000-8000-000000000010';
