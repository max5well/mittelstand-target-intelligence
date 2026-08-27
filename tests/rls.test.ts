import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

describe("workspace isolation migration", () => {
  const migration = readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(join("supabase/migrations", file), "utf8"))
    .join("\n");
  it("enables RLS and checks membership instead of authenticated-only policies", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("private.is_workspace_member(workspace_id)");
    expect(migration).toContain("private.can_write_workspace(workspace_id)");
  });
  it("protects privileged helper functions outside the exposed schema", () => {
    expect(migration).toContain("create schema if not exists private");
    expect(migration).toContain(
      "revoke all on function private.claim_enrichment_job",
    );
  });
  it("uses security-invoker analytics views", () =>
    expect(migration).toContain("with (security_invoker = true)"));
});
