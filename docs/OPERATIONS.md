# Zielunternehmen Operations Runbook

## Provider recovery and paid smoke test

1. Open the provider dashboards linked from **Einstellungen → Integrationen**.
2. Top up OpenRegister and Tavily according to the account owner’s approved budget.
3. Choose one non-sensitive target with a known OpenRegister identifier.
4. Run `Profil aktualisieren` once. Confirm HTTP 200, a succeeded job, and the expected actual-credit row.
5. Run website discovery once. Its no-retry upper bound is 14 credits: Tavily 2 + Firecrawl 2 + OpenRegister lookup 10.
6. Confirm the provider-health row changes from `Guthaben erschöpft` to `Erreichbar` after a successful event.

Do not bulk-run enrichment as a health check. A single controlled target is sufficient.

## Error monitoring and alerts

All uncaught Next.js server errors and caught API failures emit one-line JSON to Vercel Runtime Logs. Each client-safe API error includes an `errorId` that can be searched in those logs.

For active alerts, choose one:

- Set `ERROR_WEBHOOK_URL` in the Vercel Production environment to an approved HTTPS incident endpoint.
- On Vercel Pro/Enterprise, configure a production Log Drain for runtime logs and alert on `level=error` or `event=stale-enrichment-jobs-recovered`.

After deployment, inspect the first-hour production errors with `vercel logs <production-url> --level error --since 1h`.

## Database migration and rollback discipline

- Preview migrations with `npx supabase db push --linked --dry-run`.
- Apply only reviewed, committed migrations with `npx supabase db push --linked`.
- Confirm parity with `npx supabase migration list --linked`.
- Never edit an applied migration. Add a forward migration to reverse or repair it.

The 2026-09-02 audit migration normalizes ownership percentages to fractions, adds a 0–1 check constraint, and prevents concurrent running jobs for the same company/provider/stage.

## Backup and restore drill

Before inviting users, confirm the hosted Supabase plan’s backup/PITR retention in the Supabase dashboard. Quarterly:

1. Record the newest available restore point.
2. Restore it into an isolated non-production project.
3. Run `npx supabase migration list --linked` against that project.
4. Verify row counts for `companies`, `company_financial_periods`, `company_owners`, `enrichment_jobs`, and `provider_usage_events`.
5. Run `npm run test:rls` against the isolated stack.
6. Record elapsed recovery time, missing data window, operator, and outcome in the incident log.
7. Destroy the isolated restore after review.

Schema-only recovery material can be generated without customer rows using `npx supabase db dump --linked --schema public,private`.

## GDPR workspace export

Use the backend-authorized data path to export only the requested workspace. Include the parent `companies` rows and every child table keyed by `workspace_id`, plus audit and provider-usage history. Store the export encrypted, record who requested and generated it, deliver it through an approved channel, and delete the temporary artifact according to the privacy notice.

Never use an anonymous key for exports, and never export multiple workspaces into one user-facing archive.

## Stuck-job recovery

Provider jobs receive a 55-second lease; each provider attempt has a 15-second timeout. The daily discovery route marks expired `running` jobs failed and logs the count. A failed job remains retryable. Investigate repeated recoveries before increasing time limits.

## Deployment reproducibility

Production must be linked to the GitHub repository and deployed from a commit. Required pre-deploy gates are lint, typecheck, unit tests, build, RLS integration, and Playwright. Do not promote a dirty working tree with `vercel --prod`.
