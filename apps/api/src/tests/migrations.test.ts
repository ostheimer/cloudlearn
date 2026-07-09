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

  it("adds 'refund' to the lp_transactions type constraint for failed-charge reversals", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260708120000_add_refund_lp_type.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // Swaps the CHECK constraint rather than leaving the old one in place
    expect(sql).toContain("drop constraint if exists lp_transactions_type_check");
    expect(sql).toContain("add constraint lp_transactions_type_check");
    // Keeps every previously allowed type AND adds the new 'refund' one
    for (const type of [
      "abo_grant",
      "earned",
      "purchased",
      "ad_reward",
      "referral",
      "spent",
      "win_back",
      "event_bonus",
      "admin",
      "refund",
    ]) {
      expect(sql).toContain(`'${type}'`);
    }
  });

  it("makes milestone claim atomic (guard + credit in one claim_milestone_lp fn)", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260708150000_atomic_claim_milestone.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    expect(sql).toContain("create or replace function claim_milestone_lp");
    // Idempotency guard AND credit live in the same function body
    expect(sql).toContain("insert into rewards_claimed");
    expect(sql).toContain("on conflict (user_id, reward_key) do nothing");
    expect(sql).toContain("insert into lp_transactions");
    expect(sql).toContain("grant execute on function claim_milestone_lp(uuid, text, int) to service_role");
  });

  it("keeps profile deletion backed by cascading user-data references", () => {
    const migrationDir = join(apiRoot, "supabase/migrations");
    const migrationFiles = [
      "20260209230000_init.sql",
      "20260212120000_add_courses_folders_sharing.sql",
      "20260312150000_add_lp_system.sql",
      "20260312200000_add_social_features.sql",
    ];
    const sql = migrationFiles
      .map((file) => readFileSync(join(migrationDir, file), "utf-8"))
      .join("\n")
      .toLowerCase();

    const cascadingProfileReferences =
      sql.match(/references profiles\(id\) on delete cascade/g) ?? [];

    expect(cascadingProfileReferences.length).toBeGreaterThanOrEqual(10);
    expect(sql).toContain("friend_id  uuid        not null references profiles(id) on delete cascade");
  });
});
