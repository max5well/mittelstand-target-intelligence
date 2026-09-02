import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const status = execFileSync("npx", ["supabase", "status", "-o", "env"], {
  encoding: "utf8",
});
const local = Object.fromEntries(
  status
    .split("\n")
    .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const apiUrl = local.API_URL;
const anonKey = local.ANON_KEY;
const serviceRoleKey = local.SERVICE_ROLE_KEY;
const jwtSecret = local.JWT_SECRET;
assert(
  apiUrl && anonKey && serviceRoleKey && jwtSecret,
  "Local Supabase credentials unavailable",
);

const admin = createClient(apiUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const workspaceA = "00000000-0000-4000-8000-000000000010";
const workspaceB = randomUUID();
const { error: workspaceError } = await admin
  .from("workspaces")
  .insert({ id: workspaceB, name: "RLS Test B" });
assert.equal(
  workspaceError,
  null,
  `Unable to create workspace: ${workspaceError?.message}`,
);

const users = [
  { email: "wiese@dge.technology", id: randomUUID(), workspace: workspaceA },
  {
    email: "leonhardt@dge.technology",
    id: randomUUID(),
    workspace: workspaceB,
  },
];
for (const user of users) {
  const { error } = await admin.auth.admin.createUser({
    id: user.id,
    email: user.email,
    email_confirm: true,
    app_metadata: { provider: "google", providers: ["google"] },
  });
  assert.equal(
    error,
    null,
    `Unable to create ${user.email}: ${error?.message}`,
  );
}
// Admin-created users are email-provider fixtures, not Google OAuth signups. Set
// memberships explicitly so this test exercises RLS independently of the Auth
// signup hook (the hook has its own database function and app-level tests).
const { error: membershipDeleteError } = await admin
  .from("workspace_memberships")
  .delete()
  .in(
    "user_id",
    users.map((user) => user.id),
  );
assert.equal(membershipDeleteError, null);
const { error: membershipInsertError } = await admin
  .from("workspace_memberships")
  .insert([
    {
      workspace_id: workspaceA,
      user_id: users[0].id,
      role: "analyst",
      status: "active",
    },
    {
      workspace_id: workspaceB,
      user_id: users[1].id,
      role: "analyst",
      status: "active",
    },
  ]);
assert.equal(
  membershipInsertError,
  null,
  `Unable to create memberships: ${membershipInsertError?.message}`,
);

const companyA = randomUUID();
const companyB = randomUUID();
const { error: companyInsertError } = await admin.from("companies").insert([
  {
    id: companyA,
    workspace_id: workspaceA,
    openregister_company_id: `rls-a-${companyA}`,
    legal_name: "Workspace A GmbH",
  },
  {
    id: companyB,
    workspace_id: workspaceB,
    openregister_company_id: `rls-b-${companyB}`,
    legal_name: "Workspace B GmbH",
  },
]);
assert.equal(
  companyInsertError,
  null,
  `Unable to create companies: ${companyInsertError?.message}`,
);

const concurrentJobs = await Promise.all([
  admin.from("enrichment_jobs").insert({
    workspace_id: workspaceA,
    company_id: companyA,
    provider: "openregister",
    job_type: "details",
    status: "running",
    idempotency_key: `concurrency-a-${randomUUID()}`,
  }),
  admin.from("enrichment_jobs").insert({
    workspace_id: workspaceA,
    company_id: companyA,
    provider: "openregister",
    job_type: "details",
    status: "running",
    idempotency_key: `concurrency-b-${randomUUID()}`,
  }),
]);
assert.equal(
  concurrentJobs.filter((result) => result.error === null).length,
  1,
  "Exactly one concurrent provider job must be admitted",
);
assert.equal(
  concurrentJobs.filter((result) => result.error?.code === "23505").length,
  1,
  "The duplicate active provider job must hit the unique index",
);

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
function tokenFor(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url({ alg: "HS256", typ: "JWT" });
  const body = base64url({
    aud: "authenticated",
    exp: now + 3600,
    iat: now,
    sub: user.id,
    role: "authenticated",
    email: user.email,
    app_metadata: { provider: "google" },
  });
  const signature = createHmac("sha256", jwtSecret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}
function clientFor(user) {
  return createClient(apiUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${tokenFor(user)}` } },
  });
}

const userA = clientFor(users[0]);
const { data: visible, error: visibleError } = await userA
  .from("companies")
  .select("id,workspace_id")
  .order("id");
assert.equal(visibleError, null);
assert.deepEqual(
  visible?.map((row) => row.id),
  [companyA],
);

const crossWorkspaceInsert = await userA.from("companies").insert({
  workspace_id: workspaceB,
  openregister_company_id: `forbidden-${randomUUID()}`,
  legal_name: "Forbidden GmbH",
});
assert.equal(crossWorkspaceInsert.error?.code, "42501");

const anon = createClient(apiUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anonRead = await anon.from("companies").select("id");
assert.deepEqual(anonRead.data, []);
const anonInsert = await anon.from("companies").insert({
  workspace_id: workspaceA,
  openregister_company_id: `anon-${randomUUID()}`,
  legal_name: "Anonymous GmbH",
});
assert.equal(anonInsert.error?.code, "42501");

console.log(
  "RLS integration verification passed: anonymous and cross-workspace access denied.",
);
