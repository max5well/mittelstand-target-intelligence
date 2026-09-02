# Zielunternehmen — Production Readiness Audit

> **Remediation update (2026-09-02):** Implementation status, production changes, verification evidence, and remaining account-owner actions are recorded in [`REMEDIATION-REPORT.md`](./REMEDIATION-REPORT.md). The findings below remain the original audit snapshot and are preserved for traceability.

- **Application:** Company Search / Zielunternehmen (private German target-intelligence workspace)
- **Production URL:** https://zielunternehmen.vercel.app
- **Repo path:** `/Users/maxwell/personal/Company Search`
- **Audit date:** 2026-09-02
- **Code state:** commit `bab2d2d` + 8 modified files + 6 untracked source paths (uncommitted but deployed)
- **Stack:** Next.js 16.3.3 (App Router, Turbopack), React 19.2.8, Supabase (auth + Postgres), Vercel (region `fra1`), Zod 4.4.3
- **Providers:** OpenRegister, Tavily, Apollo, Firecrawl
- **Credits consumed during audit:** 0 (no paid provider endpoint was called)
- **Production configuration modified:** none (read-only inspection)

## How to review this document

This is an audit report produced by one AI agent and intended for independent verification by another. Please:

1. Challenge each finding's **evidence** — file:line references are given so they can be opened directly.
2. Flag any finding where the stated **verification method** does not actually support the stated conclusion.
3. Flag findings that are **speculative** (labelled "static inspection only") but written as if confirmed.
4. Check the **credit arithmetic** in F-04 and the **unit-conversion reasoning** in F-07 and the lineage matrix — these are the most error-prone claims.
5. Note the **self-correction** recorded below; check whether the corrected conclusion is right.

### Verification vocabulary used throughout

| Label             | Meaning                                                                   |
| ----------------- | ------------------------------------------------------------------------- |
| Live production   | Observed by HTTP request against the deployed app or its Supabase project |
| Production DB     | Read from the live Supabase database via the backend access token         |
| Official docs     | Confirmed against current provider documentation, checked 2026-09-02      |
| Browser           | Observed visually in a real browser session                               |
| Local dev         | Observed running the app locally against the real Supabase project        |
| Static inspection | Read from source code only; runtime behaviour NOT observed                |
| Not verified      | No evidence gathered; explicitly unproven                                 |
| Blocked           | Could not verify (missing credentials, or would consume paid credits)     |

### Recorded self-correction

An earlier hypothesis in this audit was that `persistFinancials` (`lib/enrichment/openregister.ts:347-355`) understated all money fields by 100×, because it writes `indicator.revenue` into a column named `revenue_cents` with no multiplication. **This was wrong.** Current OpenRegister documentation states that `indicators[].revenue`, `ebitda`, `ebit`, `net_income`, `equity`, `cash`, `financial_debt` and `balance_sheet_total` are **already in cents**. The pass-through is therefore correct. The genuine unit bug is F-07 (ownership percentage), which is a different field on a different endpoint. A reviewer should confirm this correction rather than assume it.

---

## 1. Executive summary

**Recommendation: READY AFTER NAMED BLOCKING FIXES** (conditional ship).

**Finding counts:** P0 = 0 · P1 = 6 · P2 = 8 · P3 = 5 · verified-correct areas = 9

**Is it safe to invite the two intended users?** Yes with respect to access control. Authentication is enforced server-side at three independent layers, Google SSO is confirmed working in production, RLS blocks anonymous access to the live database, and no unauthenticated route returned data under direct probing. There is no P0 — no active breach, no data-loss emergency, no live authentication bypass.

**What blocks the invite is trust in the displayed data, not security.** Two providers are currently returning HTTP 402 (out of credits) in production; every failed provider call still writes full credit cost to the ledger; the website-discovery cost estimate shown to users understates the true ceiling by roughly 1.7×; and ownership percentages will render 100× too small as soon as credits are restored.

**Most important remaining risks**

1. The credit ledger cannot currently be trusted for spend decisions (F-02, F-03, F-04).
2. The deployed build is not reproducible from version control (F-06).
3. The completed-action guard has a real race window enabling duplicate paid calls (F-05).
4. Two environment flags exist in the Production scope that would disable authentication entirely if set to `true` (F-01).

**Confidence.** High on authentication, routing, schema state and Next.js correctness — all verified live or against the production database. Moderate on provider data paths: OpenRegister `details` is proven end-to-end by HTTP 200 rows in production, but `financials`, `owners`, Apollo enrichment and Firecrawl extraction have **never succeeded in production**, so their complete data path and failure behaviour are unproven. Full list of unverified areas in §6.

---

## 2. Findings

### P1 — blocks external production use

---

#### F-01 — Auth-bypass flags are present in the Production environment

- **Priority:** P1
- **Verification:** Live production
- **Evidence:**
  - `vercel env ls production` lists both `OWNER_ONLY_PREVIEW_MODE` and `LOCAL_AUTH_BYPASS` scoped to **Production**.
  - `lib/auth/preview.ts:8` — `return process.env.OWNER_ONLY_PREVIEW_MODE === "true";` with **no `NODE_ENV` guard**.
  - Contrast `lib/auth/api.ts:25-27` and `lib/auth/user.ts:22-24`, which both guard `LOCAL_AUTH_BYPASS` with `process.env.NODE_ENV !== "production"`.
  - `lib/auth/preview.ts:16-19` reads identity from request headers `oai-authenticated-user-id` and `oai-authenticated-user-email` and trusts them verbatim.
  - `lib/auth/api.ts:28-36` — when an owner identity is present, returns `{ ok: true, role: "admin", workspaceId: requestedWorkspaceId ?? <default> }`.
- **Currently exploitable:** No. Spoofing both headers against `https://zielunternehmen.vercel.app/overview` returned `307 → /login`, so both flags resolve to a non-`"true"` value today. (Actual values not read, per the instruction not to expose secret values.)
- **Failure scenario:** Anyone who sets `OWNER_ONLY_PREVIEW_MODE=true` in Vercel — or copies the variable into a new project during a rebuild — grants full admin access to any request carrying two attacker-controlled headers. No password, no Google account, and the caller supplies their own `x-workspace-id`.
- **Impact:** One dashboard toggle away from total workspace compromise. Largest latent risk in the codebase.
- **Recommended fix:** Add `&& process.env.NODE_ENV !== "production"` to `isOwnerOnlyPreviewMode()`, and delete both variables from the Production scope (retain in Development only).
- **Suggested test:** Extend `tests/auth-preview.test.ts` to assert `getOwnerPreviewIdentity` returns `null` when `NODE_ENV === "production"` even with the flag set and both headers present.
- **Requires:** Code change + Vercel environment change. No migration.

---

#### F-02 — OpenRegister and Tavily are dead in production (HTTP 402)

- **Priority:** P1
- **Verification:** Production DB + Browser (local dev UI)
- **Evidence:** Query of production `enrichment_jobs` ordered by `completed_at desc`:

```
provider     | job_type          | status    | http | actual_credits
-------------|-------------------|-----------|------|---------------
openregister | details           | failed    | 402  | 10
openregister | details           | failed    | 402  | 10
tavily       | website_discovery | failed    | 402  | 12
tavily       | website_discovery | failed    | 402  | 12
openregister | search            | succeeded | 200  | 10
openregister | owners            | failed    | 402  | 10
openregister | financials        | failed    | 402  | 10
openregister | details           | failed    | 402  | 10
```

- Error text originates at `lib/integrations/http.ts:36-39`: `"The provider account has no usable credits or billing access."`
- Company detail page in the UI shows all four historical runs as **"Fehlgeschlagen"**.
- These real 402 responses also prove production runs with `MOCK_PROVIDERS=false` (genuine outbound provider calls are being made).
- **Failure scenario:** An invited user opens any company, clicks "Profil aktualisieren", and receives a raw error. Every enrichment card except `search` fails.
- **Impact:** The core value proposition — enriching a German target from official registry data — does not currently function for new companies.
- **Recommended fix:** Top up the OpenRegister and Tavily accounts before inviting anyone. Add a pre-flight balance/health surface so 402 renders as a specific "Provider-Guthaben erschöpft" state instead of a generic failure.
- **Suggested test:** Assert `ProviderError.status === 402` maps to a distinct user-facing state.
- **Requires:** Provider billing action; code change only for the improved messaging.

---

#### F-03 — Failed provider calls are billed full credits in the ledger

- **Priority:** P1
- **Verification:** Static inspection + Production DB
- **Evidence:**
  - `lib/enrichment/openregister.ts:166` and `:180` — catch block writes `actual_credits: cost` (10) unconditionally.
  - `lib/enrichment/external-providers.ts:204` — same pattern, `actual_credits: config.credits`.
  - Only **one** path handles this correctly: `lib/enrichment/external-providers.ts:458` — `actual_credits: status === 402 ? 0 : 10`.
  - Production `provider_usage_events` confirms the effect — rows with `http_status` 402 **and** 404 both carry `actual_credits: 10`:

```
provider     | endpoint                        | actual_credits | http_status
-------------|---------------------------------|----------------|------------
openregister | GET /v1/company/:id             | 10             | 200
openregister | GET /v1/company/:id/owners      | 10             | 402
openregister | GET /v1/company/:id/financials  | 10             | 404
openregister | GET /v1/company/:id             | 10             | 402
tavily       | POST /search                    | 2              | 200
```

- **Failure scenario:** A 402 means the provider did no work and charged nothing, yet 10 credits are recorded. A 404 on `financials` is a legitimate "not reported" answer whose real cost differs from a hard failure.
- **Impact:** Spend dashboards and the saved-search monthly estimate **overstate** actual consumption. Overstating is safer than understating, but it makes reconciliation against provider invoices impossible.
- **Recommended fix:** Write `actual_credits: 0` for 402 and transport-level failures; retain real cost for statuses the provider does bill. Prefer the provider's own reported figure where available — Firecrawl returns `creditsUsed`, already parsed at `lib/integrations/web-research.ts:62` and then ignored.
- **Suggested test:** Table-driven test over statuses {200, 402, 404, 429, 500} asserting the `actual_credits` written for each.
- **Requires:** Code change only.

---

#### F-04 — Website-discovery credit estimate is not an honest upper bound

- **Priority:** P1
- **Verification:** Static inspection + Official docs
- **Evidence:**
  - UI displays **"ca. 2–14 Cr."** — `components/company-actions.tsx:68`.
  - Job row stores `estimated_credits: input.searchRunId ? 4 : 14` — `lib/enrichment/external-providers.ts:296`.
  - Firecrawl `/v2/search` is called with `limit: 10` **and** `scrapeOptions: { formats: ["markdown"], onlyMainContent: true }` — `lib/integrations/web-research.ts:148-155`.
  - That call is billed a flat 2 credits — `lib/enrichment/external-providers.ts:359`.
  - Firecrawl docs (https://docs.firecrawl.dev/billing.md, checked 2026-09-02): search costs **2 credits per 10 results, plus 1 credit per scraped page**.
  - Retry logic: `lib/integrations/http.ts:18-34` retries up to 3 attempts on 429/5xx, while every usage event hardcodes `request_count: 1`.
- **Credit arithmetic (please verify independently):**

```
Chain in runWebsiteDiscovery (manual run, searchRunId = null):
  1. Tavily discoverOfficialWebsite            -> usage event 2 credits
     verifyCandidates() -> at most ONE OpenRegister lookup = 10 credits
        (gated by shared flag `openRegisterLookupAttempted`,
         external-providers.ts, so it cannot fire twice)
  2. If still unverified: Firecrawl discoverOfficialWebsite -> usage event 2 credits
     verifyCandidates() -> lookup already attempted, so no second lookup

  Code's accounted maximum:  2 + 2 + 10 = 14   (matches the displayed 14)

  Actual provider-side maximum per official docs:
     Tavily advanced search                      2
     Firecrawl search (2) + up to 10 scrapes    12
     OpenRegister /v0/search/lookup             10
     TRUE CEILING                               24    vs 14 displayed  (~1.7x)

  Plus: fetchProvider retries up to 3x on 429/5xx while request_count
  stays 1, so real spend can exceed even 24 and is invisible in the ledger.
```

- **Failure scenario:** A user approves a paid action based on a number roughly 1.7× too low.
- **Impact:** Directly contradicts the application's own stated promise that costs are shown before execution.
- **Recommended fix:** Either drop `scrapeOptions` from the discovery search (it only needs URLs and titles, reducing real cost to 2), or raise the displayed range to the true ceiling and record `creditsUsed` from the response. Count retries in `request_count`.
- **Suggested test:** Assert the sum of maximum `usageEvents` in `runWebsiteDiscovery` equals the number rendered on the card, locking estimate and reality together.
- **Requires:** Code change only.

---

#### F-05 — Completed-action guard is a non-atomic read-then-insert

- **Priority:** P1
- **Verification:** Static inspection (code) + Production DB (schema confirmed applied)
- **Evidence:**
  - `lib/enrichment/openregister.ts:49-67` — `select("id,status,...").eq("status","succeeded").maybeSingle()`, then a separate `insert` at `:71-87`.
  - `lib/enrichment/external-providers.ts:67-85` — identical pattern.
  - Table constraint is `unique(workspace_id, idempotency_key)` — migration `20260827185859_initial_target_intelligence_schema.sql` line 111.
  - But the key is built as `` `${input.companyId}:${input.stage}:${randomUUID()}` `` — `lib/enrichment/openregister.ts:80` (and `external-providers.ts:97`, `:293`). **Because a fresh UUID is embedded, the key can never collide, so the unique constraint never dedupes anything.**
- **Mitigations that do exist (verified):** the client disables the button via `disabled={busy !== null || needsWebsite || completed}` (`components/company-actions.tsx`), and the API route strips `force` (see §"verified correct"). So this is a genuine but narrow window, not a wide-open hole.
- **Failure scenario:** Two browser sessions or tabs both read "no succeeded job" within the same few hundred milliseconds, both insert a `running` job, and both call the provider — duplicate paid spend. For the `owners` stage this also means two concurrent `delete`-then-`insert` cycles on `company_owners` (`lib/enrichment/openregister.ts:388-419`), briefly leaving ownership rows deleted but not yet re-inserted. A serverless retry of a timed-out invocation reproduces this with a single user.
- **Impact:** Duplicate charges plus a transient window of missing ownership data.
- **Recommended fix:** Make the idempotency key deterministic — `` `${companyId}:${stage}` `` — so the existing unique constraint does the work, and treat a unique-violation insert as "already running or succeeded". Stronger option: a partial unique index on `(company_id, provider, job_type) where status in ('running','succeeded')`.
- **Suggested test:** Fire two concurrent `runOpenRegisterEnrichment` calls against a mocked provider and assert the provider function is invoked exactly once.
- **Requires:** Code change, and a migration if the partial index is chosen.

---

#### F-06 — The deployed build cannot be reproduced from version control

- **Priority:** P1
- **Verification:** Local Git state + Vercel deployment list
- **Evidence:**
  - `git diff --stat` → 8 modified files, **240 insertions / 130 deletions**, none committed:
    `.env.example`, `app/api/companies/[id]/enrich/route.ts`, `app/page.tsx`, `components/company-actions.tsx`, `components/germany-map.tsx`, `lib/enrichment/external-providers.ts`, `lib/format.ts`, `supabase/config.toml`
  - Untracked source paths: `app/datenschutz/`, `components/provider-logo.tsx`, `lib/map-visualization.ts`, `tests/enrichment-route.test.ts`, `tests/format.test.ts`, `tests/map-visualization.test.ts`
  - `vercel ls zielunternehmen` → every Production deployment is CLI-pushed by user `max5well`; there is no Git connection.
- **Failure scenario:** The live site contains the `/datenschutz` privacy page, the provider logos, the map-visualisation module and the credit-label changes — none of which exist in any commit. If this machine is lost, the deployed application cannot be rebuilt. A rollback to `bab2d2d` silently removes the GDPR page that production currently links to from its footer.
- **Impact:** No rollback path, no audit trail, no second maintainer. Because the app links a privacy notice for real users, losing that page is also a compliance problem.
- **Recommended fix:** Commit the working tree (it typechecks, lints and passes all 56 tests), push, then connect the Vercel project to the Git repository so Production builds come from a commit SHA. Keep the `AGENTS.md` block committed, as its own note instructs.
- **Suggested test:** CI check asserting `git status --porcelain` is empty at deploy time.
- **Requires:** Git commit + Vercel project setting. No code change.

---

### P2 — important reliability or correctness problems

---

#### F-07 — Ownership percentages render 100× too small

- **Priority:** P2
- **Verification:** Official docs + static inspection. **Not yet observable in production** because every `owners` run has failed with 402 (F-02); it will surface as soon as credits are restored.
- **Evidence:**
  - OpenRegister documentation (checked 2026-09-02, `/v1/company/{company_id}/owners` and `/holdings`): `percentage_share` — _"Share of the company. Example: 0.5 represents 50% ownership"_ → a **fraction in 0..1**.
  - `lib/enrichment/openregister.ts:403` — `ownership_percent: asNumber(owner.percentage_share)` stores the fraction raw.
  - `lib/data/companies.ts:206-213` — passes it through as `percentage`.
  - `app/(dashboard)/companies/[id]/page.tsx:261` — renders `` `${owner.name}${owner.percentage === null ? "" : ` · ${owner.percentage}%`}` ``.
  - Schema permits it silently: `ownership_percent numeric(6,3)` (migration `20260827185859`, line 96) — max 999.999, no check constraint.
- **Failure scenario:** A sole shareholder holding 100% displays as **"1%"**; a 50/50 pair display as "0.5%" each.
- **Scope note:** The same fraction feeds `.order("ownership_percent", { ascending: false })` (`lib/data/companies.ts:70`) — harmless, ordering is preserved. The owner-managed classification heuristic (`lib/enrichment/openregister.ts:421-436`) compares **names**, not percentages, so classification is unaffected.
- **Impact:** Ownership concentration is the central screening criterion for an acquisition target; showing 1% instead of 100% inverts the reading.
- **Recommended fix:** Either multiply by 100 on ingest and backfill, or keep the fraction and render with `formatPercent` (`lib/format.ts:27-33`), which already handles fractions correctly. Pick one and add `check (ownership_percent between 0 and 100)`.
- **Suggested test:** Given `percentage_share: 0.5`, assert the rendered string is `"50%"`.
- **Requires:** Code change + migration (constraint and backfill).

---

#### F-08 — No request timeout on any provider call

- **Priority:** P2
- **Verification:** Static inspection + local Next.js 16.3.3 documentation
- **Evidence:**
  - `lib/integrations/http.ts:21` — `const response = await fetch(url, { ...init, cache: "no-store" });`. No `AbortSignal`, no `AbortSignal.timeout()`.
  - No route in the application sets `maxDuration` (grep across `app/`); confirmed semantics from `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md`.
  - Only route segment config present anywhere is `export const dynamic = "force-dynamic"` at `app/(dashboard)/layout.tsx:4`.
- **Failure scenario:** A hung provider socket holds the serverless function until Vercel's platform limit, then the function is killed. The `enrichment_jobs` row is left stranded in `running` forever — the `catch` block never executes, so nothing marks it failed. With 3 retries a slow provider can also burn 3× the wall clock; the discovery chain (Tavily + Firecrawl + OpenRegister, each up to 3 attempts) is the worst case.
- **Impact:** Stuck jobs accumulate with no detector. Note these stranded rows do not block future runs, since the guard only checks `succeeded` — but they pollute history and hide real failures.
- **Recommended fix:** Add `signal: AbortSignal.timeout(15_000)` in `fetchProvider`; set an explicit `maxDuration` on the enrich route; add a sweeper that fails `running` jobs whose `started_at` exceeds the timeout. The schema already provides `lease_expires_at` and `heartbeat_at` columns for exactly this and they are unused.
- **Suggested test:** Mock a never-resolving fetch and assert `fetchProvider` rejects within the budget.
- **Requires:** Code change; migration only if a sweeper job is added.

---

#### F-09 — Firecrawl scrapes an unvalidated user-supplied URL (SSRF-adjacent)

- **Priority:** P2
- **Verification:** Static inspection. Requires an authenticated allowlisted user, so exploitation today is limited to the two trusted accounts — the concern is blast radius and misconfiguration, not an anonymous attacker.
- **Evidence:**
  - `app/api/companies/route.ts:14-17` — `website: z.union([z.literal(""), z.string().url()]).optional().default("")`. `z.string().url()` accepts `http://localhost:3000/`, `http://169.254.169.254/`, `http://10.0.0.1/`, and `file:` URLs.
  - Stored at `app/api/companies/route.ts:57` — `website_url: parsed.data.website || null`.
  - Passed verbatim as the scrape target: `lib/integrations/web-research.ts:104` — `url: input.verifiedDomain`.
  - Also parsed for Apollo at `lib/enrichment/external-providers.ts:111-112` — `new URL(company.website_url).hostname.replace(/^www\./, "")`.
- **Failure scenario:** The fetch is performed by **Firecrawl's** infrastructure, not the application's, so this is not a classic internal-metadata SSRF against your own network. However a `file://`, `localhost` or RFC-1918 URL still gets stored, displayed as a company website, transmitted to a third party, and billed. Separately, `new URL()` on a non-HTTP scheme throws **outside** the try block (line 111 precedes the `try` at line 108 in the surrounding flow), producing an unhandled 502 and stranding the job in `running`.
- **Impact:** Data quality, wasted credits, and one crash path that strands a job row.
- **Recommended fix:** Validate scheme ∈ {http, https} and reject private, loopback and link-local hosts at the Zod layer; move the `new URL()` parse inside the try block.
- **Suggested test:** Reject `file:///etc/passwd`, `http://localhost`, `http://169.254.169.254`; accept `https://example.de`.
- **Requires:** Code change only.

---

#### F-10 — Zod schemas will throw on documented provider response shapes

- **Priority:** P2
- **Verification:** Official docs (2026-09-02) compared against code
- **Evidence:**
  - **Firecrawl:** docs state `metadata.title`, `description`, `language`, `keywords` may each be `string | string[]`. Code types title as `z.string().optional()` (`lib/integrations/web-research.ts`), so an array value throws a `ZodError` mid-enrichment.
  - **Apollo:** `organization.id: z.string()` is **required and non-nullable** (`lib/integrations/apollo/index.ts:9`). A response containing an organization without `id` throws. The top-level `organization: null` case _is_ handled (line 18), covering the common no-match path.
  - **OpenRegister:** `details`, `financials` and `owners` are parsed with `GenericCompanyResponseSchema = z.record(z.string(), z.unknown())` (`lib/integrations/openregister/index.ts:65`) — **no validation whatsoever**. A silent upstream field rename degrades to nulls rather than erroring.
  - **OpenRegister search:** `SearchItemSchema` marks `register_number`, `register_type`, `register_court`, `active`, `legal_form`, `address` as optional/nullable, though docs list them as required on `CompanySearchResponseItem`. `address: z.unknown().optional()` discards a fully documented structured object (`city`, `country`, `formatted_value`, `street`, `postal_code`, `extra`).
- **Failure scenario:** A `ZodError` raised inside the try block is caught, so the job is marked `failed` and **full credits are billed for a response that actually arrived** — compounding F-03. The OpenRegister `z.record` case is worse: a renamed field silently becomes `N/V` and reads as "not reported" rather than a broken integration.
- **Impact:** Provider schema drift fails silently or bills for nothing. This is the principal long-term operability risk.
- **Recommended fix:** Accept `z.union([z.string(), z.array(z.string())])` for Firecrawl metadata; make Apollo `id` optional; replace the OpenRegister `z.record` with real schemas for the fields actually consumed, kept tolerant via `.passthrough()`.
- **Suggested test:** Fixture-parse tests using the documented response examples, including an array-valued `title`.
- **Requires:** Code change only.

---

#### F-11 — OpenRegister `owners` 404s for AG/SE targets and bills for the failure

- **Priority:** P2
- **Verification:** Official docs + Production DB
- **Evidence:**
  - OpenRegister docs (2026-09-02): the owners endpoint returns **404 for AG/SE legal forms unless `best_available=true` is passed**. `lib/integrations/openregister/index.ts` never sends this parameter.
  - `lib/enrichment/openregister.ts:103-112` converts a 404 on a non-`details` stage into `payload = { available: false, reason: "not_reported_by_provider" }` and then marks the job **`succeeded`** (line 133) with `actual_credits: cost` (10).
  - Production `provider_usage_events` already shows `GET /v1/company/:id/owners` with `http_status: 404` and `actual_credits: 10`.
- **Failure scenario:** An AG target permanently reports "keine Eigentümerdaten", the card is **disabled as successfully completed**, 10 credits are spent, and the user cannot retry — the guard only re-runs `failed` jobs. Genuinely unreported data and a wrong request parameter become indistinguishable in the UI.
- **Impact:** Ownership data unreachable for an entire legal-form class, with no retry path and a misleading "Abgeschlossen · nicht verfügbar" label.
- **Recommended fix:** Send `best_available=true`. The response field `best_available` is already consumed at `lib/enrichment/openregister.ts:408`. Distinguish "provider reports none" from "request shape wrong".
- **Suggested test:** Assert the owners request includes the parameter, and that a 404 does not permanently disable the action.
- **Requires:** Code change only.

---

#### F-12 — No error or loading boundaries anywhere in the App Router

- **Priority:** P2
- **Verification:** Filesystem inspection + static inspection
- **Evidence:**
  - `find app -name "error.tsx" -o -name "loading.tsx" -o -name "global-error.tsx" -o -name "not-found.tsx"` → **no results**.
  - Server pages throw freely, e.g. `lib/data/companies.ts:36` — `throw new Error("Unable to load companies: " + error.message)`.
  - Every dashboard route is `force-dynamic` (`app/(dashboard)/layout.tsx:4`) with no `loading.tsx`.
- **Failure scenario:** A transient Supabase error on `/companies` throws in a Server Component with no `error.tsx` to catch it, so the user sees Next.js's default error screen rather than the app shell. Slow queries show a blank page instead of a skeleton.
- **Impact:** Any backend hiccup looks like a hard crash; no graceful degradation during a provider or database outage.
- **Recommended fix:** Add `app/(dashboard)/error.tsx` and `loading.tsx`, plus a root `global-error.tsx`. Keep messages non-revealing (see F-13).
- **Suggested test:** Force the loader to throw and assert the boundary renders with a retry affordance.
- **Requires:** Code change only.

---

#### F-13 — Raw provider and database messages are returned to the client

- **Priority:** P2
- **Verification:** Static inspection; the 402 text is confirmed present in production `error_details`
- **Evidence:**
  - `app/api/companies/[id]/enrich/route.ts:54-62` — returns `error: error instanceof Error ? error.message : "Anreicherung fehlgeschlagen."` with status 502.
  - `app/api/providers/openregister/search/route.ts:45-52` — same pattern; and `z.treeifyError(error)` returned on 400 (line 41).
  - Propagated messages include Supabase error text via `throw new Error(companyError.message)` and the provider string `"Provider request to api.openregister.de failed with status 402. The provider account has no usable credits or billing access."`
- **Explicitly checked:** no key material or secret value appears in any error message.
- **Failure scenario:** An authenticated user — and anyone reading their screen or a shared screenshot — sees provider hostnames, vendor billing state and Postgres error text.
- **Impact:** Information disclosure. Low severity given the two-user allowlist, but the messages are also not actionable for the user.
- **Recommended fix:** Log detail server-side; return a stable German message plus an error id. Keep the credit-exhausted case as an explicit friendly state (F-02).
- **Suggested test:** Assert the 502 body contains no provider hostname and no `status \d{3}` substring.
- **Requires:** Code change only.

---

#### F-14 — No error monitoring, and unbounded queries will silently truncate at 1,000 rows

- **Priority:** P2
- **Verification:** Static inspection
- **Evidence:**
  - `SENTRY_DSN` is declared in `.env.example` but **no Sentry package is installed and no init exists**; the only observability is `console.error` (10 call sites across `app/api/companies/[id]/route.ts` and `app/api/companies/[id]/favorite/route.ts`).
  - `lib/data/companies.ts:25-95` — one `companies` query plus 9 parallel child queries, all `select("*")`, **none with `.limit()` or `.range()`**.
  - `supabase/config.toml:18` — `max_rows = 1000`.
- **Important nuance:** this is a **fixed 10-query fan-out, not N+1** — the query count does not grow with company count. The problem is row volume, not round trips.
- **Failure scenario:** PostgREST caps each result at 1,000 rows and still returns HTTP 200. `company_financial_periods` holds one row per fiscal year per company, so at roughly 100–150 companies that query begins **silently dropping financial history** — companies quietly show the wrong latest year with no error surfaced. Meanwhile a production exception today is visible only in Vercel logs nobody watches.
- **Impact:** Wrong financial figures presented as authoritative, with no alerting to notice. First hard scaling wall.
- **Recommended fix:** Paginate the company list and fetch child rows only for the visible page, or aggregate latest-period server-side in a view. Add Sentry or Vercel log drains with alerts on 5xx and on `enrichment_jobs.status='failed'`.
- **Suggested test:** Seed 1,200 financial rows and assert no silent truncation.
- **Requires:** Code change; database view optional.

---

### P3 — improvements and maintainability

---

#### F-15 — The RLS test asserts nothing about RLS

- **Priority:** P3
- **Verification:** Read the test file. RLS enforcement itself **was** separately verified live (see §5) — the test simply does not prove it.
- **Evidence:** `tests/rls.test.ts:5-22` reads the migration `.sql` files into a string and runs `expect(migration).toContain("enable row level security")`. It is a **string match on SQL text** — no database connection, no policy execution.
- **Impact:** False confidence. The suite would stay green if a policy were logically inverted, or dropped in a later migration that still contained the phrase.
- **Recommended fix:** Run the assertions against the local Supabase stack (`npm run db:local:start` already exists) with two seeded users, asserting cross-workspace reads return zero rows.
- **Requires:** Test-only change.

---

#### F-16 — The Playwright E2E suite is stale and not part of verification

- **Priority:** P3
- **Verification:** Read the spec and compared against the rendered German UI
- **Evidence:** `tests/e2e/critical-flow.spec.ts` expects English strings — `getByRole("heading", { name: "Companies" })`, `"Ownership & management"`, `"New saved search"`, `getByPlaceholder("Search company, city, owner, register ID…")` — but the application ships in German ("Unternehmen", "Eigentümer", "Gespeicherte Suchen"). `test:e2e` is a separate npm script and is **not** run by `npm test`.
- **Impact:** The only end-to-end coverage would fail if executed, so nobody runs it. All 56 passing tests are unit-level.
- **Recommended fix:** Update selectors to the German strings or add `data-testid` attributes, and wire into CI.
- **Requires:** Test-only change.

---

#### F-17 — Search route bills 10 credits even when no provider call is made

- **Priority:** P3
- **Verification:** Static inspection. Production runs live (`MOCK_PROVIDERS=false`, proven by the real 402s), so this currently misreports only in dev/preview.
- **Evidence:** `app/api/providers/openregister/search/route.ts:23-34` inserts `estimated_credits: 10, actual_credits: 10, http_status: 200` unconditionally after `search()` — but `OpenRegisterProvider.search` returns mock fixtures when `MOCK_PROVIDERS !== "false"` (`lib/integrations/openregister/index.ts:87`), costing nothing.
- **Impact:** Development and preview traffic inflates the credit ledger, further eroding its trustworthiness.
- **Recommended fix:** Skip the usage insert in mock mode, or tag the row with a `mock` flag and exclude it from spend views.
- **Requires:** Code change only.

---

#### F-18 — Search results beyond 100 are unreachable

- **Priority:** P3
- **Verification:** Static inspection. Whether 100 is the true API ceiling **could not be confirmed** from the documentation available.
- **Evidence:** `CompanySearchRequestSchema` bounds `per_page` at `.max(100)` (`lib/integrations/openregister/index.ts:43`); `lib/discovery/run-saved-search.ts:91-94` always requests `page: 1`. The returned `pagination` object (total pages/results) is parsed and never used to fetch page 2.
- **Impact:** A saved search matching more than 100 companies silently discovers only the first page. `daily_target` is capped at 100 by a check constraint, so the system is currently self-consistent — but this caps growth.
- **Recommended fix:** Loop pages using the returned pagination metadata, honouring `daily_target` and a credit ceiling.
- **Requires:** Code change only.

---

#### F-19 — Minor correctness and polish items

- **Priority:** P3
- **Items:**
  - **(a)** `/mfa` is prerendered **static** (build output line `○ /mfa`) while every other authenticated route is dynamic. An auth-adjacent page should not be a static asset. _Static inspection of build output._
  - **(b)** The Google consent screen displays the raw Supabase host `<SUPABASE_PROJECT_REF>.supabase.co` instead of a branded application name. _Verified live in the browser._ Looks like phishing to a cautious user.
  - **(c)** Tavily is called without `topic: "news"` (`lib/integrations/web-research.ts:227`) yet the UI promises "Web & Nachrichten recherchieren". Per docs, `published_date` is not in the general-search result schema, so `publishedAt` will be `null` and news recency is effectively unused. _Official docs._
  - **(d)** Firecrawl `sources: ["web"]` uses a string shorthand where docs specify `[{ type: "web" }]`. May be accepted for backward compatibility but is not the documented shape. _Official docs._
  - **(e)** `owners[].nominal_share` is multiplied by 100 into `nominal_share_cents` (`lib/enrichment/openregister.ts:404-407`) although docs describe it as a share/capital **amount** ("Example: 100"), not euros — likely wrong semantics. Currently unobservable and not surfaced in the UI. _Official docs._
  - **(f)** Apollo ignores documented fields available on the same billed call: `industry`, `founded_year`, `total_funding`, `technologies`, `owned_by_organization`, `ultimate_parent_organization` — the last two directly relevant to acquisition screening. _Official docs._
  - **(g)** `lib/enrichment/openregister.ts:24-28` hardcodes cost 10, while `company(companyId, realtime = false)` at `lib/integrations/openregister/index.ts:133-135` supports `realtime=true`, which docs price at **20**. **Latent only — no caller passes it today** (only call site is `openregister.ts:98` with the default).
- **Impact:** Individually small; (b) affects first-run trust for the invited users, and (g) becomes a real undercount the moment realtime is used.
- **Requires:** Code changes; (b) is a Google Cloud OAuth consent-screen setting.

---

### Verified correct — recorded as supporting evidence

The audit instruction was to explicitly record areas found correct. Nine areas were confirmed:

1. **Google SSO — the previously observed error is definitively resolved.** `GET https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/settings` returns `"google": true` with every other provider `false` and `"email": false`. Clicking "Mit Google anmelden" in a real browser reached the genuine Google consent screen with client id `<GOOGLE_OAUTH_CLIENT_ID>`, `scope=email profile`, and `redirect_uri=https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`. **The exact configuration responsible** is the Google provider being enabled in the hosted Supabase project; the new `[auth.external.google]` block in `supabase/config.toml` (uncommitted) mirrors this for the local stack only. The `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}` condition no longer reproduces. _Live production + browser._
2. **Allowlist depth — enforced at three independent server-side layers, none UI-only.** `app/auth/callback/route.ts:42-45` (calls `supabase.auth.signOut()` on mismatch, then redirects `access_denied`); `lib/auth/user.ts:57` (page render); `lib/auth/api.ts:67` (every API route). Plus a database `before_user_created` hook `private.restrict_google_signup` returning HTTP 403 (migration `20260902085413`), and `private.handle_new_user` restricting the membership insert to the two addresses. All layers check `app_metadata.provider === "google"` in addition to the email (`lib/auth/access.ts:21-27`). _Static + SQL._
3. **The Gmail support address is not allowlisted.** `maximiliandev5@gmail.com` appears only as the privacy contact rendered on `/datenschutz`. It is absent from `ALLOWED_EMAILS` (`lib/auth/access.ts:6-9`) and from both SQL allowlists. _Static + live page text._
4. **Unauthenticated access is refused everywhere probed.** `/overview` → `307 → /login`; `POST /api/companies` → `401 {"error":"Authentication required"}`; `POST /api/companies/[id]/enrich` → `401`; `POST /api/cron/daily-discovery` → `401 {"error":"Unauthorized"}` (cron requires `Bearer ${CRON_SECRET}`, `app/api/cron/daily-discovery/route.ts:6-11`). No data returned in any case. _Live production._
5. **A crafted `force=true` cannot bypass the completed-action guard.** The route's Zod schema accepts **only** `stage` (`app/api/companies/[id]/enrich/route.ts:13-15`) and strips unknown keys, so `force` never reaches the enrichment function — which does support an internal `force` parameter, but only for server-side callers. Proven live (401 with `force:true` unauthenticated) and by unit test `tests/enrichment-route.test.ts:46-66`, which asserts the enrichment function is invoked with exactly `{workspaceId, companyId, stage}`. _Live + unit test._
6. **RLS is genuinely enforced in production.** Using the public publishable key against the live project: `companies`, `enrichment_jobs`, `saved_searches` → `200` with `[]` and `content-range: */0`; `workspace_memberships`, `profiles` → `401 permission denied for table`; anon `INSERT` into `companies` → `401 {"code":"42501","message":"new row violates row-level security policy for table \"companies\""}`; email signup → `400 {"error_code":"email_provider_disabled"}`. Anon can neither read nor write workspace data. _Live production._
7. **No schema drift.** `supabase migration list --linked` shows all five local migrations present remotely with identical timestamps: `20260827185859`, `20260828053000`, `20260828054500`, `20260828133422`, `20260902085413`. Privileged helpers live in a non-exposed `private` schema with `set search_path = ''` and explicit `revoke`s. _Live production DB._
8. **Next.js 16 correctness.** Build clean; typecheck, lint and 56 tests pass. **No deprecated `middleware.js`** — renamed to `proxy.js` in Next 16 per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md`; this app has neither file and uses per-route checks instead, which avoids the middleware-bypass class of vulnerability entirely. No `server-only` leak into client bundles: `lib/db/admin.ts`, `lib/auth/api.ts`, `lib/auth/preview.ts` and every integration module import `"server-only"`. Cron duplicate execution is prevented by `unique(saved_search_id, run_key)` plus `upsert(..., { ignoreDuplicates: true })` (`app/api/cron/daily-discovery/route.ts:42-54`). _Static + build + local docs._
9. **Map, UI and security headers.** All four map controls verified working in a real browser: **Status**, **Eigentümer** and **Score** each swap the legend and marker colours (Score correctly greyed all markers to "Kein Score", matching zero scored companies); **Ergebnisse einpassen** present, with `aria-pressed` on the mode buttons (`components/germany-map.tsx:188`). Completed cards render disabled and greyed with a timestamp and "Abgeschlossen" label; failed runs remain retryable; dependent actions are gated with the reason "Nicht verfügbar, bis eine verifizierte Website gespeichert ist"; "Run all" excludes completed actions (`components/company-actions.tsx:186-191`). Mobile 375 px layout clean; keyboard focus ring clearly visible; no console errors on production landing or login. Live response headers confirm CSP, HSTS `max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`, `X-Robots-Tag: noindex, nofollow`; `app/robots.ts` disallows all. No `dangerouslySetInnerHTML` anywhere in the codebase. `npm audit --omit=dev` → **0 vulnerabilities**. _Live production + browser + static._

---

## 3. Provider contract matrix

Documentation checked **2026-09-02**. No authenticated or paid provider calls were made; OpenRegister was consulted only through its read-only documentation interface.

| Provider / endpoints                                                                                                                       | Auth                                                                                                     | Validation                                                          | Timeout  | Retry         | Rate limit                                                     | Pagination                         | Credits shown / real                               | Idempotency                           | Test coverage | Verification status                                   | Main risk                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------- | ------------- | -------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------- | ------------------------------------- | ------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **OpenRegister**<br>`POST /v1/search/company`<br>`GET /v1/company/{id}`<br>`GET …/financials`<br>`GET …/owners`<br>`GET /v0/search/lookup` | OK — `Authorization: Bearer`                                                                             | **WEAK** — `z.record` for details/financials/owners = no validation | **none** | 3× on 429/5xx | **Undocumented** — no rate-limit page exists                   | Documented but **unused**          | 10 / 10 correct; **20 if `realtime=true`** (F-19g) | **Race** (F-05)                       | Unit only     | **details LIVE 200**; financials/owners only ever 402 | No schema validation; AG/SE owners 404 (F-11)                                                       |
| **Tavily**<br>`POST /search`                                                                                                               | OK — `Authorization: Bearer tvly-…`                                                                      | OK\* — `published_date` not in documented schema                    | **none** | 3× on 429/5xx | 100 RPM dev / 1000 RPM prod; documented `retry-after` honoured | n/a (capped by `max_results` ≤ 20) | 2 / 2 correct (advanced = 2)                       | **Race** (F-05)                       | Unit only     | **402 in production**                                 | Out of credits; no `topic:"news"` (F-19c)                                                           |
| **Firecrawl**<br>`POST /v2/scrape`<br>`POST /v2/search`                                                                                    | OK — `Authorization: Bearer`                                                                             | **THROWS** — `title` may be `string[]` (F-10)                       | **none** | 3× on 429/5xx | 10 RPM (Free) → 10,000 RPM (Scale); `Retry-After` undocumented | n/a (`limit` 1–100)                | **2 / up to 12 — WRONG** (F-04)                    | **Race** (F-05)                       | Unit only     | **Not verified**                                      | **6× cost undercount**; array title crashes                                                         |
| **Apollo**<br>`GET /api/v1/organizations/enrich`                                                                                           | OK — `X-Api-Key` (docs say `x-api-key`; HTTP headers are case-insensitive per RFC 9110, so this is fine) | **STRICT** — `id` required, throws on partial (F-10)                | **none** | 3× on 429/5xx | Per plan (e.g. 600/hour free)                                  | n/a (single org)                   | 1 / 1 correct                                      | Upsert on `(workspace_id, apollo_id)` | Unit only     | **Not verified**                                      | Blocked behind website discovery; `match_confidence` hardcoded `null` (`external-providers.ts:130`) |

**Summary:** Endpoints and authentication are correct for all four providers against current documentation — including OpenRegister's `/v0/search/lookup`, which genuinely is v0 and is not deprecated. Credit costs are correct for Tavily (advanced = 2), Apollo (1 per organization) and OpenRegister (10, or 20 realtime). The single hard cost error is Firecrawl search (F-04). No provider has a request timeout, and none of the four has had its complete data path plus failure behaviour demonstrated end-to-end in production except OpenRegister `details`.

---

## 4. Data-lineage matrix

| Field               | Provider → response path                                                 | Transformation                                                              | Database                                               | UI location                                             | Fallback                       | Confidence / risk                                                  |
| ------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------ |
| Legal company name  | OpenRegister details → `name.name`                                       | fallback to `payload.name`                                                  | `companies.legal_name`, `company_names`                | Detail header, table                                    | `asText()` → null              | Low                                                                |
| Registration number | OR details → `register.register_number`                                  | direct                                                                      | `companies.register_number`                            | Eyebrow "HRB9909 · Amtsgericht Bochum"                  | null                           | Low                                                                |
| Registry court      | OR details → `register.register_court`                                   | read from raw payload, not the typed field                                  | `raw_provider_payload`                                 | Eyebrow                                                 | "N/V"                          | Medium — not normalised into a column                              |
| Address             | OR details → `address.*`                                                 | `street ?? formatted_value`; delete-then-insert scoped to `source_provider` | `company_locations`                                    | Detail, map marker                                      | `country_code` defaults `"DE"` | Medium — delete+insert not transactional (F-05)                    |
| Industry            | OR details → `industry_codes.WZ2025`                                     | `lib/wz2025.ts` lookup                                                      | `raw_provider_payload`                                 | "BRANCHE" — currently shows `N/A`                       | "N/A"                          | Medium — structured codes discarded by `z.unknown()` (F-10)        |
| Company purpose     | OR details → `purpose.purpose`                                           | fallback to `payload.purpose`                                               | `companies.purpose`                                    | "Unternehmensgegenstand"                                | "N/A"                          | Low                                                                |
| Management          | OR details → `representation[]`                                          | skip unnamed; `role ?? "Representative"`                                    | `company_management`                                   | "Management" list                                       | "N/V"                          | Low                                                                |
| **Owners %**        | OR owners → `owners[].percentage_share`                                  | **none — fraction stored raw**                                              | `company_owners.ownership_percent` `numeric(6,3)`      | `` `${percentage}%` `` at `companies/[id]/page.tsx:261` | omitted if null                | **HIGH — 100× too small (F-07)**                                   |
| Nominal share       | OR owners → `owners[].nominal_share`                                     | `× 100`                                                                     | `nominal_share_cents`                                  | not surfaced                                            | null                           | Medium — semantics unclear (F-19e)                                 |
| Revenue             | OR financials → `indicators[].revenue`                                   | **none — CORRECT**, docs confirm value is already in cents                  | `company_financial_periods.revenue_cents`              | `formatMoney` → "58 Mio. €"                             | "N/V"                          | **Verified correct**                                               |
| EBITDA              | OR financials → `indicators[].ebitda`                                    | none — correct (cents)                                                      | `.ebitda_cents`                                        | Detail + margin calc                                    | "N/V"                          | Verified correct                                                   |
| Employee count      | OR financials → `indicators[].employees`                                 | direct                                                                      | `.employees`                                           | "Beschäftigte"                                          | "—"                            | Low                                                                |
| Apollo revenue      | Apollo → `organization.annual_revenue`                                   | `× 100` (euros → cents)                                                     | `apollo_organizations.estimated_revenue_cents`         | Provider-enrichment block                               | null                           | Medium — different unit basis from OpenRegister, same UI formatter |
| Capital             | OR details → `capital.amount`                                            | `× 100` (docs: decimal euros)                                               | derived at read time (`lib/data/companies.ts:220-223`) | "STAMMKAPITAL"                                          | "N/V"                          | Medium — `currency` DEM/USD ignored                                |
| Website             | Tavily/Firecrawl search → evidence verify → OR lookup `company_id` match | multi-signal profile match                                                  | `companies.website_url`                                | Profile; gates Apollo + Firecrawl cards                 | `no_verified_match`            | Medium — unvalidated scheme (F-09)                                 |
| News / web research | Tavily `results[]`, Firecrawl `data.web[]`                               | `persistWebSources`                                                         | `web_sources`, `web_claims`                            | "Anbieteranreicherung"                                  | empty state                    | Medium — `publishedAt` always null (F-19c)                         |
| Investment score    | internal — `lib/scoring/index.ts`                                        | weighted config                                                             | `company_scores`                                       | Map "Score" mode, "Eignung"                             | "—" / "Kein aktiver Score"     | Low — no rows exist yet                                            |
| Status              | internal — user-set                                                      | `check` constraint, 11 allowed values                                       | `companies.status`                                     | Badge, map "Status" mode                                | default `'new'`                | Low                                                                |

**Provenance assessment — a genuine strength.** Every child table carries `source_provider`, `source_identifier` and `retrieved_at`; deletes are scoped per provider (`.eq("source_provider","openregister")`), so one provider cannot wipe another's rows; and `company_sources` retains the raw payload. The source displayed in the UI therefore does correspond to the provider that produced the field, and conflicting values across providers do not silently overwrite one another.

**The real gap is staleness, not provenance.** Nothing displays how old an enrichment is next to the value it produced, so a two-year-old figure reads as current as today's. Additionally, `persistDetails` overwrites `legal_form`, `register_number`, `website_url`, `purpose` and `incorporation_date` with `asText(...)` results that may be `null` (`lib/enrichment/openregister.ts:217-227`) — only `legal_name` is conditionally guarded — so a sparse provider response **can null out previously valid data**.

---

## 5. Authentication matrix

| Scenario                     | Expected                  | Actual result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Verification method       |
| ---------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `wiese@dge.technology`       | Full access, analyst role | **Not executed** — requires the user's own credentials. Allowlisted in `lib/auth/access.ts:7` and in both SQL paths; membership auto-created as `analyst`/`active` by `private.handle_new_user`.                                                                                                                                                                                                                                                                                                                                         | Static + SQL              |
| `leonhardt@dge.technology`   | Full access, analyst role | **Not executed** — identical treatment, same code path (`lib/auth/access.ts:8`).                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Static + SQL              |
| Unauthorized Google user     | Rejected, no session      | **Enforced at 4 layers** — callback signs out and redirects `access_denied`; page layer redirects; API layer 403 "Account access denied"; DB hook returns HTTP 403. **Not executed end-to-end** (needs a third Google account).                                                                                                                                                                                                                                                                                                          | Static + SQL              |
| Signed-out user              | Redirect to /login        | **PASS** — `/overview` → `307 → /login`; all API routes `401`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Live production           |
| Expired / invalid session    | Redirect to /login        | **PASS by construction** — `supabase.auth.getUser()` validates against the Auth server on every request (not a local JWT decode); `jwt_expiry = 3600`, `enable_refresh_token_rotation = true`, `refresh_token_reuse_interval = 10`. Not executed with a real expired token.                                                                                                                                                                                                                                                              | Static + config           |
| Disabled Google provider     | Clear error, no crash     | **RESOLVED** — `/auth/v1/settings` returns `"google": true`; browser reached the real Google consent screen. Historical `validation_failed / provider is not enabled` no longer reproduces. Client-side failure path exists at `components/login-form.tsx:24-30` with a German message.                                                                                                                                                                                                                                                  | Live production + browser |
| Invalid callback             | Graceful redirect         | **PASS** — missing `code` → `auth_error` (`route.ts:36`); exchange failure → `auth_error` (`:38`); missing config → `configuration`. German message rendered, no config leaked. Verified visually at `/login?reason=access_denied`.                                                                                                                                                                                                                                                                                                      | Static + browser          |
| Local bypass in production   | Impossible                | **Not exploitable today, but latent** — header spoof returned `307 → /login`, yet both flags are scoped to Production and `OWNER_ONLY_PREVIEW_MODE` has no `NODE_ENV` guard. **See F-01.**                                                                                                                                                                                                                                                                                                                                               | Live production           |
| Open redirect                | Blocked                   | **Safe in application code** — the callback ignores any user-supplied `next`/`redirect` parameter and always sends users to `/overview` (`route.ts:46`). Supabase accepts an arbitrary `redirect_to` at `/authorize` (confirmed: `redirect_to=https://evil.example.com/steal` was echoed into the Google URL), but the **final** redirect is constrained by the project's `additional_redirect_urls` allowlist, which lists only the Vercel and localhost callbacks. `NEXT_PUBLIC_APP_URL` is used as the redirect base (`route.ts:12`). | Live + config             |
| Direct Supabase REST as anon | No data                   | **PASS** — `[]` / `content-range: */0` on workspace tables; `401 permission denied` on `profiles` and `workspace_memberships`; RLS violation on insert; email signup disabled.                                                                                                                                                                                                                                                                                                                                                           | Live production           |

---

## 6. Test and verification results

### Commands executed

| Command                                | Result    | Detail                                                      |
| -------------------------------------- | --------- | ----------------------------------------------------------- |
| `npm run typecheck`                    | **PASS**  | `next typegen && tsc --noEmit` — types generated, no errors |
| `npm run lint`                         | **PASS**  | ESLint 9.39.4, zero warnings                                |
| `npm test` (`vitest run`)              | **PASS**  | **20 files, 56 tests**, 439 ms                              |
| `npm run build`                        | **PASS**  | Turbopack, compiled 1089 ms, 12 static pages, 22 routes     |
| `git diff --check`                     | **PASS**  | No whitespace errors                                        |
| `git status --short`                   | **DIRTY** | 8 modified + 6 untracked source paths (F-06)                |
| `npm audit --omit=dev`                 | **PASS**  | 0 vulnerabilities                                           |
| `npx supabase migration list --linked` | **PASS**  | 5/5 migrations applied remotely, no drift                   |

### Routes tested

- **Production (unauthenticated):** `/`, `/login`, `/login?reason=access_denied`, `/datenschutz`, `/overview` (redirect), `/api/companies` (401), `/api/companies/[id]/enrich` (401), `/api/cron/daily-discovery` (401), plus Supabase `/auth/v1/settings`, `/auth/v1/authorize`, `/auth/v1/signup`, and REST endpoints for 5 tables.
- **Local dev (mock-auth admin, real Supabase data — 19 companies):** `/overview`, `/companies`, `/companies/[id]` (all 7 enrichment cards + execution history), `/map` (all 3 colour modes toggled), `/jobs`, `/settings`, `/searches`, `/analytics` — all HTTP 200.

### Browser flows

Landing page, login page, access-denied state, the Google OAuth handoff (**stopped at the consent screen — no credentials entered**), privacy page, mobile 375 px layout, keyboard focus traversal, and the three map colour modes.

### Console and hydration errors

No hydration warnings and no console errors on production landing or login. **One local-dev error** on `/map`: `"Failed to load module script: The server responded with a non-JavaScript MIME type of 'text/html'"`, alongside map tiles that took a few seconds to appear on first load. It did **not** reproduce on production and resembles a Turbopack dev-server artifact, but it touches the map bundle and warrants a second look.

### Not verified / blocked

- Login as either DGE user (needs the user's credentials).
- Rejection of a third-party Google account end-to-end (needs a third Google account).
- **Whether the `before_user_created` hook is registered in the hosted Supabase project.** `supabase/config.toml` governs only the local stack; the Management API requires a token not available in this environment. **This should be confirmed in the Supabase dashboard.** The application-level allowlist would still reject such a user at three layers even if the hook were absent.
- Any live provider data path for Firecrawl extraction, Apollo matching, OpenRegister `financials`/`owners`, and website discovery — all blocked by HTTP 402 and by the instruction not to consume credits.
- Production Web Vitals (no RUM configured).
- Supabase backup/PITR configuration (not inspectable read-only at this access level).

### Credits consumed

**Zero.** No paid provider endpoint was called. OpenRegister was consulted only through read-only documentation search. Provider health was inferred from existing production database rows, not from new calls.

---

## 7. Production-readiness checklist

| Area                       | Status                    | Basis                                                                                                                                          |
| -------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication             | **PASS**                  | Google enabled and reached live; unauthenticated routes redirect or 401                                                                        |
| Authorization              | **PASS with caveat**      | Three server-side layers + DB hook; F-01 flags present in Production                                                                           |
| Database security          | **PASS**                  | RLS enforced live; privileged functions in `private` schema; no drift                                                                          |
| Provider correctness       | **FAIL**                  | Firecrawl cost 6× off; weak/throwing schemas; AG/SE owners broken                                                                              |
| Idempotency                | **FAIL**                  | Read-then-insert race; idempotency key defeated by `randomUUID()`                                                                              |
| Credit protection          | **FAIL**                  | Estimate not an upper bound; failures billed full cost                                                                                         |
| Error handling             | **FAIL**                  | No error/loading boundaries; raw messages surfaced                                                                                             |
| Monitoring                 | **FAIL**                  | `console.error` only; `SENTRY_DSN` declared but unwired                                                                                        |
| Backups                    | **NOT VERIFIED**          | Supabase plan-level PITR not inspectable read-only; no documented restore drill                                                                |
| Deployment reproducibility | **FAIL**                  | CLI deploys, 240 uncommitted lines, 6 untracked source files                                                                                   |
| Privacy & legal            | **PASS**                  | `/datenschutz` live and dated 2026-09-02; names controller, data, purpose, legal basis, processors, retention, rights; `noindex` + robots deny |
| Mobile & accessibility     | **PASS**                  | 375 px clean; visible focus ring; `aria-pressed`, `role="alert"`/`"status"`, labelled icon buttons                                             |
| Performance                | **PASS at current scale** | Fixed 10-query fan-out (not N+1); unbounded selects hit `max_rows` at ~100+ companies                                                          |

### Scaling outlook

- **10 companies** — comfortable. Current state (19) performs fine.
- **100** — first wall: `company_financial_periods` approaches `max_rows = 1000` and begins silently truncating (F-14). The map renders all markers client-side with only co-location grouping, no clustering.
- **1,000** — the unpaginated company list ships a large payload to the client, and the 10-query fan-out returns tens of thousands of rows. `/companies` and `/map` become the bottleneck. Pagination is mandatory here.
- **10,000** — requires server-side pagination and filtering, map clustering or vector tiles, a materialised latest-financials view, and a real job queue: the current in-request enrichment model cannot absorb the volume within serverless limits.

---

## 8. Prioritized remediation plan

### Before inviting anyone

| #   | Action                                                                                                                                            | Finding | Complexity | Dependencies                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- | ------------------------------------ |
| 1   | Delete `OWNER_ONLY_PREVIEW_MODE` and `LOCAL_AUTH_BYPASS` from the Vercel Production scope; add the `NODE_ENV` guard to `isOwnerOnlyPreviewMode()` | F-01    | Trivial    | None                                 |
| 2   | Top up OpenRegister and Tavily credits, then run one real enrichment to prove the path end-to-end                                                 | F-02    | Trivial    | Billing action                       |
| 3   | Commit and push the working tree; connect Vercel to Git                                                                                           | F-06    | Trivial    | **Do this before any further edits** |
| 4   | Fix ownership-percentage rendering (×100 or use `formatPercent`)                                                                                  | F-07    | Small      | Migration for constraint + backfill  |
| 5   | Correct the website-discovery cost — drop `scrapeOptions` from the discovery search, or raise the displayed ceiling                               | F-04    | Small      | None                                 |
| 6   | Stop billing failed calls — `actual_credits: 0` on 402 and transport errors                                                                       | F-03    | Small      | None                                 |
| 7   | Confirm in the Supabase dashboard that `before_user_created` points at `private.restrict_google_signup`                                           | §6      | Trivial    | Verification only                    |

### First week after launch

| #   | Action                                                                                                                   | Finding    | Complexity         |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------ |
| 8   | Deterministic idempotency key + unique-violation handling; ideally the partial unique index                              | F-05       | Medium (migration) |
| 9   | `AbortSignal.timeout()` in `fetchProvider`, explicit `maxDuration`, stuck-`running` sweeper using existing lease columns | F-08       | Medium             |
| 10  | `error.tsx` / `loading.tsx` / `global-error.tsx`; sanitised API errors with server-side logging                          | F-12, F-13 | Small              |
| 11  | Send `best_available=true` for owners so AG/SE targets work                                                              | F-11       | Trivial            |
| 12  | URL scheme/host validation on manual company creation; move `new URL()` inside the try                                   | F-09       | Small              |

### First month

| #   | Action                                                                                                               | Finding    | Complexity                                          |
| --- | -------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------- |
| 13  | Real Zod schemas for OpenRegister endpoints; tolerate `string \| string[]` for Firecrawl metadata; relax Apollo `id` | F-10       | Medium — main defence against silent provider drift |
| 14  | Wire error monitoring; alert on 5xx and failed enrichment jobs                                                       | F-14       | Small                                               |
| 15  | Paginate company list and child-row fetches before crossing ~100 companies                                           | F-14       | Medium                                              |
| 16  | Execute RLS tests against the local stack; repair and run Playwright in CI                                           | F-15, F-16 | Medium                                              |
| 17  | Surface enrichment age next to each value so stale data cannot read as current                                       | §4         | Small                                               |
| 18  | Set a branded Google OAuth consent-screen name                                                                       | F-19b      | Trivial (Google Cloud console)                      |

### Longer term

19. Move enrichment to a queue with leases and heartbeats — the schema already anticipates this.
20. Record provider-reported credits (`creditsUsed`) rather than hardcoded constants; reconcile monthly against invoices.
21. OpenRegister search pagination beyond page 1 (F-18).
22. Document a backup/restore drill and a data-export path for GDPR requests.
23. Circuit breaker per provider so a sustained outage degrades gracefully instead of failing every card.
24. Guard `persistDetails` against nulling previously valid fields from a sparse response (§4).

---

## 9. Final release recommendation

**READY AFTER NAMED BLOCKING FIXES.**

The security foundation is genuinely sound, and stronger than typical for an application at this stage: real server-side authorization at three layers, working RLS verified against the live database, a defence-in-depth signup hook, zero dependency vulnerabilities, a complete security-header set, and no P0 findings. Google SSO — the thing that was previously broken — is confirmed working in production.

What is not ready is the layer the two users would actually judge it on. Two providers are out of credits, so most enrichment fails today; the credit numbers shown and recorded are wrong in both directions; and ownership percentages would display 100× too small the moment credits are restored.

### Exact actions required before sending the production URL to other people

1. Remove `OWNER_ONLY_PREVIEW_MODE` and `LOCAL_AUTH_BYPASS` from the Production scope and add the `NODE_ENV` guard — **F-01**
2. Top up OpenRegister and Tavily, and prove one enrichment end-to-end — **F-02**
3. Commit and push the working tree; connect Vercel to Git — **F-06**
4. Fix ownership-percentage rendering — **F-07**
5. Make the website-discovery credit estimate a true upper bound — **F-04**
6. Stop recording credits for failed calls — **F-03**
7. Confirm the `before_user_created` hook is registered in the hosted Supabase project — **§6**

Items 1, 3 and 7 are configuration and take minutes. Items 4, 5 and 6 are small, well-localised code changes. With those complete, inviting `wiese@dge.technology` and `leonhardt@dge.technology` is reasonable, with the F-05 race condition and the missing error boundaries scheduled for the first week.

---

_Audit performed 2026-09-02 against commit `bab2d2d` plus the uncommitted working tree. Next.js 16.3.3. Provider documentation checked 2026-09-02. No paid API calls, no credits consumed, no production configuration modified, no files in the working tree altered._
