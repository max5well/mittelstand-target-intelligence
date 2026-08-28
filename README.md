# Unternehmen

Private target intelligence for discovering, assessing, prioritizing, and tracking German Mittelstand acquisition targets.

The application is a decision-support product, not a CRM and not an automated outreach tool. It separates official provider facts from estimates, derived classifications, and analyst input. The local database starts empty except for the workspace row; live provider data is added only by explicit runs.

## What is implemented

- Invite-only Supabase authentication model with `admin`, `analyst`, and `viewer` roles; administrators require AAL2/TOTP before dashboard access.
- Workspace-aware Postgres schema, RLS policies, protected analytics view, audit model, and an atomic job-claim function in a non-exposed schema.
- Saved OpenRegister-aligned searches with plain-language summaries, hydration modes, daily scheduling, and configurable credit estimates.
- Idempotent scheduled discovery model using `saved_search_id + scheduled_date`, stable OpenRegister IDs, pagination state, deduplication joins, and job keys.
- Filterable/sortable TanStack company table with favorites, pipeline transitions, null-safe financials, source years, ownership confidence, and CSV affordance.
- Company detail experience with reported financial history, ownership versus classification, management, evidence-linked derived claims, activity, and cost-aware enrichment actions.
- Germany map experience with cached fixture coordinates, visible geocode failures, filter modes, clusters/markers, and target previews. A commercial MapLibre tile/geocoder adapter can replace the fixture visualization.
- Coverage-aware analytics, provider jobs/usage, retries, and missing-run health indicators.
- Typed adapters for OpenRegister, Apollo, Firecrawl, Tavily, OpenAI Responses structured output, and commercial geocoding. Zod validates all external boundaries.
- An empty-by-default local database with persisted provider usage events and no fictional company records.

## Architecture

- Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind CSS 4
- Supabase Postgres/Auth; SQL migrations are the source of truth
- TanStack Table, Recharts, MapLibre-compatible geocoding/map adapter
- Postgres-backed job queue with leases, attempts, retry timing, dead-letter state, provider concurrency fields, and idempotency keys
- Vitest unit/security tests and Playwright critical flows
- Vercel region `fra1`; cron only enqueues work and validates `CRON_SECRET`

Provider facts retain provider, source ID/URL, reporting date, retrieval time, raw JSON, and where appropriate confidence. Money is stored as `BIGINT` cents. Missing values remain `NULL` and render as an em dash with “Not reported.” Manual ownership classifications take precedence at the application layer.

## Local setup

Requires Node.js 22.13 or newer, Docker for the local Supabase stack, and the Supabase CLI.

```bash
npm ci
cp .env.example .env.local
npm run db:local:start
npm run db:local:reset
npm run dev:local
```

Open `http://localhost:3000`. `dev:local` injects local Supabase credentials and enables a development-only administrator bypass; the bypass is disabled in production. To verify the configured live providers and persist the check results, run `npm run verify:providers`.

Run the migration and seed explicitly:

```bash
npx supabase migration up --local
npx supabase db reset
```

`supabase db reset` applies all files in `supabase/migrations/` and then `supabase/seed.sql`.

## Environment variables

| Variable                               |       Required | Feature when absent                                              |
| -------------------------------------- | -------------: | ---------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  |     Production | Absolute application URL unavailable                             |
| `NEXT_PUBLIC_SUPABASE_URL`             |     Production | Real authentication/data disabled; development can use mock mode |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |     Production | Real browser/server user client disabled                         |
| `SUPABASE_SECRET_KEY`                  | Local/tooling  | Service-role access disabled                                     |
| `SUPABASE_SERVER_ACCESS_TOKEN`         | Sites backend | Private server database access disabled                          |
| `DATABASE_URL`                         |        Tooling | Direct migration/type-generation tooling disabled                |
| `OPENREGISTER_API_KEY`                 | Live discovery | OpenRegister adapter uses fictional fixtures                     |
| `APOLLO_API_KEY`                       |       Optional | Organization and people actions hidden/disabled in live mode     |
| `FIRECRAWL_API_KEY`                    |       Optional | First-party website analysis hidden/disabled in live mode        |
| `TAVILY_API_KEY`                       |       Optional | External news research hidden/disabled in live mode              |
| `OPENAI_API_KEY` + `OPENAI_MODEL`      |       Optional | Evidence extraction uses fixtures; raw sources remain available  |
| `MAP_TILES_URL` + `MAP_PUBLIC_TOKEN`   |       Optional | Fixture geography remains visible; production tiles disabled     |
| `GEOCODING_API_KEY`                    |       Optional | New addresses are not live-geocoded                              |
| `CRON_SECRET`                          |     Production | Cron route rejects every request                                 |
| `APP_ENCRYPTION_KEY`                   |       Contacts | Personal contact fields must remain unavailable                  |
| `SENTRY_DSN`                           |       Optional | External error reporting disabled; structured job logs remain    |
| `MOCK_PROVIDERS`                       |          Local | Set `false` to enable configured live adapters                   |
| `LOCAL_AUTH_BYPASS`                    | Local dev only | Local administrator session; ignored in production               |
| `OWNER_ONLY_PREVIEW_MODE`              |   Private site | Sites owner identity passthrough; never enable on shared/public hosting |

Never prefix secret/service keys with `NEXT_PUBLIC_`. Do not store runtime secrets in GitHub; configure them separately for Vercel Preview and Production.

`OWNER_ONLY_PREVIEW_MODE=true` is reserved for an externally protected, single-owner preview. It accepts a preview session only when the hosting layer supplies an authenticated user ID and email, and it exposes only fictional fixtures. Never enable it on a public or shared deployment; real production environments must use Supabase authentication.

## Verification

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

For a linked Supabase project, also run:

```bash
npx supabase db push
npx supabase gen types typescript --linked > lib/db/database.types.ts
npx supabase db lint --linked
```

Before using generated output redirection, review the command and target. Commit generated database types after connecting a real project.

## First user and private access

1. Disable public signup in Supabase Auth.
2. Create the first user from the Supabase administrator interface or a protected server-only admin workflow.
3. Insert an active `workspace_memberships` row with role `admin`; never use user-editable metadata for authorization.
4. Enroll a TOTP factor. Dashboard access for admins redirects until AAL2 is present.
5. Configure short JWT expiry and revoke sessions before deleting sensitive-user accounts.
6. Protect Vercel preview deployments with Vercel Authentication. If the plan supports Advanced Deployment Protection for production, enable it in addition to application authentication.

No public signup route exists. Viewers do not receive decrypted Apollo personal contact fields unless `contact_fields_authorized` is explicitly granted.

## Provider caveats and cost controls

- OpenRegister is authoritative for legal identity, address, management, official owners, and reported financials. Apollo estimates never overwrite official values.
- Current configured OpenRegister estimates are 10 credits each for advanced search, company details, financials, and owners. These values are editable because provider pricing can change.
- The owner/succession filters may require an Enterprise OpenRegister plan. Detect capabilities before enabling them.
- `realtime=true` is never the default. It is a separately confirmed refresh action.
- Firecrawl stays on the verified company domain and is capped at 20 relevant pages. Tavily queries include company, domain, and city to reduce namesake errors.
- AI output is derived, versioned, uses `store: false`, and is discarded when it lacks evidence URLs.
- Paid jobs use unique idempotency keys; a duplicate click cannot create a second queued row for the same freshness bucket.

## Deployment

1. Create an EU-region Supabase project, link it, apply migrations/seed, and generate types.
2. Import this private GitHub repository into Vercel.
3. Configure Preview and Production environment variables independently. Use an EU function region near the database; `fra1` is configured.
4. Configure `CRON_SECRET`; Vercel Cron calls `/api/cron/daily-discovery`, which only enqueues jobs.
5. Enable Vercel Authentication for previews and application invite-only auth for production.
6. Test the production URL in an incognito window. Do not consider release complete until dashboard requests redirect to login and protected data/API mutations are inaccessible.

No production deployment or live provider call should be considered verified merely because local mock mode succeeds.

## Backups, retention, export, and deletion

- Enable Supabase daily backups and Point-in-Time Recovery according to the commercial sensitivity and plan. Review backup health rather than assuming a scheduled backup completed.
- Recommended default retention: audit logs and provider-usage events 24 months; failed raw job payloads 90 days; web source evidence while a target is active plus 12 months; personal Apollo fields until a user-requested deletion or documented legitimate-purpose expiry.
- Workspace export must use an authorized, filtered server query and create an `audit_logs` event. Never export across workspaces.
- User deletion: revoke sessions, remove membership, reassign or pseudonymize attributed notes/audits as policy requires, delete encrypted personal fields, then delete the Auth user.
- Workspace deletion: produce any required encrypted export, delete provider monitors, delete storage objects, remove workspace rows through cascading foreign keys, and document completion.
- Restore: restore into an isolated project, reapply current credentials, verify RLS and membership isolation, then perform a controlled cutover.

## Troubleshooting

- Redirected with `configuration`: Supabase public variables are absent and production mock bypass is intentionally disabled.
- Redirected with `not_invited`: the user exists but has no active membership.
- Admin loops to `/mfa`: complete TOTP enrollment/challenge and refresh the session so the JWT reaches AAL2.
- Provider action unavailable: the corresponding key is absent or the OpenRegister plan capability is not enabled.
- Job stays `retry_wait`: inspect `next_attempt_at`, provider `Retry-After`, lease expiry, and attempt count before manual retry.
- Missing table through the Data API: check Supabase Data API exposure/grants separately from RLS.

## Post-MVP

- Document ingestion with Supabase Storage and evidence-level OCR.
- Two-person approval for exports and high-cost bulk enrichment.
- Native OpenRegister favorites/shortlist monitors with recurring-cost confirmation.
- IC memo generation from approved, evidence-backed claims.
- Scenario scoring and score-version comparisons.

Automated outbound email remains intentionally out of scope.
