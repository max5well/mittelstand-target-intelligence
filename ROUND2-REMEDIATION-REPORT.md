# Audit Round 2 Remediation Report

- **Date:** 2026-09-02
- **Source audit:** [`AUDIT-REPORT-ROUND2.md`](./AUDIT-REPORT-ROUND2.md)
- **Working branch:** `codex/round2-remediation`
- **Scope:** every named pre-invite fix and first-week engineering item in audit §5, plus the verifiable owner checks in §6
- **Paid provider calls made during remediation:** 0

## Outcome

All code-controlled findings from the round-two audit are remediated. The sale-listing importer is deliberately disabled in production until written source permission exists. The remaining owner-controlled gaps are purchasing/financial decisions or require an alert endpoint selected by the owner; none can safely be invented by code.

## Engineering remediation ledger

| Audit item | Status | Change and implementation evidence | Verification evidence |
| --- | --- | --- | --- |
| F-06 reproducibility | Completed | All pre-existing sale-listing/OpenRouter work and this remediation are on `codex/round2-remediation`. CI/merge/deployment evidence is recorded below. | Local unit, lint, typecheck and production build results below. |
| NEW-01 pseudo OpenRegister IDs | Completed | One canonical gate lives in [`lib/openregister-id.ts`](./lib/openregister-id.ts). The server rejects pseudo IDs before job creation in [`lib/enrichment/openregister.ts`](./lib/enrichment/openregister.ts), website discovery uses the same check in [`lib/enrichment/external-providers.ts`](./lib/enrichment/external-providers.ts), and UI actions use it in [`app/(dashboard)/companies/[id]/page.tsx`](<./app/(dashboard)/companies/[id]/page.tsx>) plus [`components/company-actions.tsx`](./components/company-actions.tsx). | [`tests/openregister-id.test.ts`](./tests/openregister-id.test.ts) covers provider, `manual:` and `concess:` IDs. |
| NEW-02 OpenRouter ledger/guard/timeout | Completed | OpenRouter has a 4,000-token output cap and 40-second timeout in [`lib/integrations/openrouter/extract.ts`](./lib/integrations/openrouter/extract.ts). A deployment-wide UTC daily token guard and one token/cost usage event per attempted call live in [`lib/enrichment/external-providers.ts`](./lib/enrichment/external-providers.ts). [`20260902203000_provider_usage_units.sql`](./supabase/migrations/20260902203000_provider_usage_units.sql) adds explicit token units and micro-dollar cost without mixing them into provider-credit totals. Action cards disclose the ≤22k-token estimate in [`components/company-actions.tsx`](./components/company-actions.tsx). Production is explicitly configured to 100,000 tokens/day. | [`tests/openrouter-extract.test.ts`](./tests/openrouter-extract.test.ts) verifies timeout, output cap and usage parsing; [`tests/external-enrichment.test.ts`](./tests/external-enrichment.test.ts) verifies budget parsing. OpenRouter documents that every response includes token counts and `usage.cost`: [Usage Accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting). |
| NEW-03 expired job leases | Completed | [`lib/enrichment/job-leases.ts`](./lib/enrichment/job-leases.ts) conditionally marks an expired conflicting row failed. All three insert paths in [`lib/enrichment/openregister.ts`](./lib/enrichment/openregister.ts) and [`lib/enrichment/external-providers.ts`](./lib/enrichment/external-providers.ts) retry once after recovery. | [`tests/job-leases.test.ts`](./tests/job-leases.test.ts) covers live, expired, absent and malformed leases plus the recovery update. |
| F-19c Tavily topic | Completed | The deliberate decision is `topic: "news"` in [`lib/integrations/web-research.ts`](./lib/integrations/web-research.ts), while the query still uses the core brand and city. This preserves news publication metadata and restores the round-one ledger claim. | Full unit suite and typecheck passed. |
| NEW-04 con\|cess hardening/legal | Code completed; permission pending | [`lib/integrations/concess/index.ts`](./lib/integrations/concess/index.ts) checks robots policy, serializes pages with a delay, enforces page/count parser contracts, and aborts rather than partially importing changed markup. [`lib/import/concess.ts`](./lib/import/concess.ts) leaves `bundesland` null. Sale listings remain excluded from company/overview/map/analytics/CSV views by default in [`lib/data/companies.ts`](./lib/data/companies.ts) and have a separate page. `CONCESS_IMPORT_ENABLED=false` is set in production and the API/UI are gated in [`app/api/providers/concess/import/route.ts`](./app/api/providers/concess/import/route.ts) and [`app/(dashboard)/sale-listings/page.tsx`](<./app/(dashboard)/sale-listings/page.tsx>). | A saved source-shaped fixture and changed-markup/robots cases live in [`tests/fixtures/concess-listing-page.html`](./tests/fixtures/concess-listing-page.html) and [`tests/concess.test.ts`](./tests/concess.test.ts). `https://matchbridge.de/robots.txt` returned HTTP 404 on 2026-09-02; this was documented as **not** granting reuse permission. Written authorization is still required before enabling. |
| NEW-05 pagination | Completed | [`lib/data/companies.ts`](./lib/data/companies.ts) adds `id` as the unique secondary order for every paged query, orders the previously unordered classification/favorites reads, and batches company IDs in groups of 100 to bound PostgREST URLs. | [`tests/data-pagination.test.ts`](./tests/data-pagination.test.ts) covers >1,000 rows and a 250-ID/three-batch read. Supabase documents ascending/descending ordering and chained order criteria: [JavaScript order reference](https://supabase.com/docs/reference/javascript/order). |
| NEW-06 retry billing / F-03 note | Completed | [`lib/integrations/http.ts`](./lib/integrations/http.ts) attributes 0 credits to 402, 429, 5xx, abort, timeout and transport failures; any other failed HTTP outcome is capped at one estimated unit. Successful fixed-price calls are no longer multiplied by retry count in both enrichment modules. Request attempts remain separately recorded. | [`tests/provider-http.test.ts`](./tests/provider-http.test.ts) covers the status matrix and a three-attempt 404. |
| F-13 con\|cess API consistency | Completed | [`app/api/providers/concess/import/route.ts`](./app/api/providers/concess/import/route.ts) now uses the shared `reportApiError` path, including an error ID and optional webhook delivery. | Typecheck, lint and build passed. |
| F-09 URL residual | Completed | [`lib/url-safety.ts`](./lib/url-safety.ts) rejects CGNAT and dotted/hex IPv4-mapped IPv6. [`lib/url-safety-server.ts`](./lib/url-safety-server.ts) rejects hostnames resolving to any private address. Stored websites are checked before use and OpenRegister contact URLs are validated during ingestion in [`lib/enrichment/openregister.ts`](./lib/enrichment/openregister.ts). | [`tests/url-safety.test.ts`](./tests/url-safety.test.ts) and [`tests/url-safety-server.test.ts`](./tests/url-safety-server.test.ts) cover these ranges and DNS rebinding candidates. |
| F-07 exact ownership value `1` | Reviewed | A read-only production query found seven `1.000` rows. Each is the sole owner row for its company, including obvious corporate-parent and sole-person ownership records, consistent with 100% rather than a legacy 1%. No data rewrite was justified. | Production query via `supabase db query --linked`, 2026-09-02. |

## Owner-controlled checks and decisions

| Item | Verified state | Required owner action |
| --- | --- | --- |
| OpenRegister/Tavily funding and paid smoke test | Production keys exist; no paid call was made and no billing account was modified. | Approve/top up a budget, then run exactly one controlled target through details and website discovery as described in [`docs/OPERATIONS.md`](./docs/OPERATIONS.md). |
| Supabase `before_user_created` | The linked production DB contains `private.restrict_google_signup(jsonb)`, and `supabase_auth_admin` has execute permission. The checked-in project config enables it. Dashboard runtime selection could not be read because no dashboard session was available. | In Supabase **Authentication → Hooks**, confirm this function is selected as `before_user_created` before invitations. Supabase’s behavior and configuration path are documented in [Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook). |
| Supabase backups/PITR | `supabase backups list` reports `walg_enabled=true`, `pitr_enabled=false`; no available backup was listed. | Choose a recovery objective and budget. PITR is a paid add-on (currently approximately $100/month for seven days and requires at least Small compute), so it was not enabled implicitly. See [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups). |
| Google OAuth consent name | Verified in Google Cloud project `zielunternehmen`: current application name is already **Zielunternehmen**. | None. F-19b is closed. |
| Alert destination | `ERROR_WEBHOOK_URL` and `SENTRY_DSN` are absent from Vercel Production. Structured logs/error IDs still work. | Select an approved incident webhook or Vercel Log Drain. Then configure and test it; the runbook is [`docs/OPERATIONS.md`](./docs/OPERATIONS.md). |
| con\|cess authorization | No public terms page or robots policy granting reuse was found. The import is explicitly off in Production. | Obtain written permission covering automated retrieval, internal storage, refresh, and display. Only then set `CONCESS_IMPORT_ENABLED=true`. |

## Verification record

| Gate | Result |
| --- | --- |
| `npm test` | PASS — 29 files, 118 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS — 0 warnings/errors |
| `npm run build` | PASS — Next.js 16.3.3 production build, all routes generated |
| `npm run test:rls` | Local attempt blocked because Docker Desktop was not running; CI result below is authoritative |
| `npx supabase db push --linked --dry-run` | PASS — exactly `20260902203000_provider_usage_units.sql` pending |
| Paid API calls | 0 |

## Delivery evidence

This section is updated after GitHub CI, merge, database migration, and Vercel Git deployment complete.

- **Feature/remediation commit:** pending
- **Pull request:** pending
- **CI:** pending
- **Merged commit:** pending
- **Production migration:** pending
- **Vercel production deployment:** pending
- **Post-deploy error scan:** pending

## Operational documentation

The durable controls and owner procedures are documented in [`README.md`](./README.md) and [`docs/OPERATIONS.md`](./docs/OPERATIONS.md). The original audit remains unchanged as evidence; this report is its disposition record.
