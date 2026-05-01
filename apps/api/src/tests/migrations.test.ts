import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Resolve relative to this file so the test works from any cwd (workspace root or apps/api)
const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("supabase migrations", () => {
  it("contains required tables and RLS policies", () => {
    const migrationPath = join(apiRoot, "supabase/migrations/20260209230000_init.sql");
    const sql = readFileSync(migrationPath, "utf-8");

    expect(sql).toContain("create table if not exists profiles");
    expect(sql).toContain("create table if not exists decks");
    expect(sql).toContain("create table if not exists cards");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("create policy \"users_own_decks\"");
  });

  it("enables RLS on LP tables and fixes leaderboard_public as security invoker", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260324120000_security_advisor_rls_leaderboard.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    expect(sql).toContain("ALTER TABLE public.lp_transactions ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.rewards_claimed ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.leaderboard_public");
    expect(sql).toContain("security_invoker = true");
  });

  it("adds an account deletion tombstone and referral cleanup function", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260404120000_add_deleted_accounts.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    expect(sql).toContain("create table if not exists deleted_accounts");
    expect(sql).toContain("create or replace function delete_account_data");
    expect(sql).toContain("set referred_by = null");
    expect(sql).toContain("delete from profiles");
    expect(sql).toContain("grant execute on function delete_account_data(uuid, text) to service_role");
  });
});
