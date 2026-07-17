import { readdirSync, readFileSync } from "node:fs";
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

  it("makes LP-pack purchase grants idempotent (partial unique index + grant fn)", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260709120000_idempotent_lp_purchase.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // Partial unique index — only 'purchased' rows, so normal spends stay free to repeat
    expect(sql).toContain("create unique index if not exists lp_transactions_purchased_reason_uidx");
    expect(sql).toContain("where type = 'purchased'");
    // Idempotent grant function with the ledger insert as the guard
    expect(sql).toContain("create or replace function grant_lp_purchase");
    expect(sql).toContain("on conflict (reason) where type = 'purchased' do nothing");
    expect(sql).toContain("grant execute on function grant_lp_purchase(uuid, int, text) to service_role");
  });

  it("persists rate-limit + idempotency state with an atomic, race-safe check", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260710120000_persistent_rate_limit_idempotency.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // Persistent, cross-instance stores (survive serverless cold starts)
    expect(sql).toContain("create table if not exists rate_limits");
    expect(sql).toContain("create table if not exists idempotency_keys");

    // Check-and-increment in a single statement → no read-modify-write count race
    expect(sql).toContain("create or replace function check_rate_limit");
    expect(sql).toContain("on conflict (key) do update set");
    expect(sql).toContain("grant execute on function check_rate_limit(text, int, int) to service_role");
  });

  it("lets the rate limit count weighted requests, so /learn/sync cannot bypass it", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260717150000_rate_limit_cost.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // Ohne p_cost zählte ein Sync-Paket mit 500 Wiederholungen als EIN Zugriff.
    expect(sql).toContain("p_cost int default 1");

    // Der Default hält den noch laufenden alten Code am Leben (drei Argumente
    // → verhält sich exakt wie bisher). Deshalb ist Migration-vor-Deploy hier
    // ungefährlich.
    expect(sql).toContain("drop function if exists check_rate_limit(text, int, int)");
    expect(sql).toContain(
      "grant execute on function check_rate_limit(text, int, int, int) to service_role",
    );

    // Ein Gewicht von 0 (oder null) würde die Bremse aushebeln.
    expect(sql).toContain("greatest(coalesce(p_cost, 1), 1)");

    // Der atomare Check-and-increment darf dabei nicht verlorengehen.
    expect(sql).toContain("on conflict (key) do update set");
  });

  it("persists the per-user Mathpix budget with an atomic consume function", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260710140000_persistent_mathpix_budget.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // Persistent, cross-instance store (survives serverless cold starts)
    expect(sql).toContain("create table if not exists mathpix_usage");

    // Add-and-return in a single statement → race-safe consume, no read-modify-write
    expect(sql).toContain("create or replace function consume_mathpix_cost");
    expect(sql).toContain("on conflict (user_id) do update set");
    expect(sql).toContain("grant execute on function consume_mathpix_cost(uuid, numeric) to service_role");
  });

  it("enables RLS on server-only persistence tables", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260710150000_enable_rls_persistent_tables.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8").toLowerCase().replace(/\s+/g, " ");

    for (const table of ["rate_limits", "idempotency_keys", "mathpix_usage"]) {
      expect(sql).toContain(`alter table public.${table}`);
      expect(sql).toContain(`public.${table} enable row level security`);
    }
  });

  it("decommissions the dead monthly-quota infra (cron + profiles columns)", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260710160000_decommission_ai_usage.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // Stops the caller first — guarded so it works with or without pg_cron
    expect(sql).toContain("cron.unschedule('reset-ai-usage-monthly')");
    expect(sql).toContain("IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')");

    // Then drops the dead quota columns + index, idempotently
    expect(sql).toContain("DROP INDEX IF EXISTS profiles_usage_period_start_idx");
    expect(sql).toContain("DROP COLUMN IF EXISTS ai_scans_used");
    expect(sql).toContain("DROP COLUMN IF EXISTS ai_url_imports_used");
    expect(sql).toContain("DROP COLUMN IF EXISTS usage_period_start");
  });

  it("makes referral claim atomic + idempotent with a per-referrer cap (#203)", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260713100000_atomic_referral_claim.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    expect(sql).toContain("create or replace function claim_referral");
    // Row-locks close the TOCTOU / lost-update races on both parties
    expect(sql).toContain("from profiles where id = p_claimer for update");
    expect(sql).toContain("from profiles where id = v_referrer for update");
    // Idempotency guard: a second claim by the same claimer short-circuits
    expect(sql).toContain("if v_claimer_referred is not null then return jsonb_build_object('status','already_referred'); end if;");
    // Per-referrer cap gates ONLY the sender bonus (claimer is always paid)
    expect(sql).toContain("if v_referrer_count < p_referrer_cap then");
    expect(sql).toContain("grant execute on function claim_referral(uuid, text, int, int, int) to service_role");
  });

  it("grants monthly Pro LP idempotently per (user, billing period) (#209)", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260713110000_monthly_lp_grant.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // Per-(user, period) primary key is the idempotency guard against re-delivered webhooks
    expect(sql).toContain("create table if not exists monthly_lp_grants");
    expect(sql).toContain("primary key (user_id, period)");
    // Server-only table: RLS on, no policy (service_role bypasses it) — mirrors the LP tables
    expect(sql).toContain("alter table monthly_lp_grants enable row level security");
    // Idempotent grant fn: insert-guard + reuse of the atomic add_lp credit
    expect(sql).toContain("create or replace function grant_monthly_lp");
    expect(sql).toContain("on conflict (user_id, period) do nothing");
    expect(sql).toContain("if not found then return false");
    expect(sql).toContain("perform add_lp(p_user, p_amount, 'abo_grant'");
    expect(sql).toContain("grant execute on function grant_monthly_lp(uuid, text, int, text) to service_role");
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

  it("drops the shared_decks_visible policy that exposed every tokened deck to anon", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260716145829_drop_shared_decks_policy.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // Exactly one policy goes, and it's the token rule — public_decks_visible
    // (deliberately-public decks) and users_own_decks must survive untouched.
    const drops = sql.match(/drop\s+policy[^;]*;/gi) ?? [];
    expect(drops).toHaveLength(1);
    expect(drops[0]).toContain('drop policy if exists "shared_decks_visible" on decks');
  });

  it("never leaves a decks select policy that grants read on merely HAVING a share_token", () => {
    // `share_token is not null` says the deck HAS a token, not that the caller
    // KNOWS it — and policies are OR'ed, so such a rule silently overrides
    // users_own_decks and publishes every once-shared deck to anon. Reading the
    // migrations in apply order and requiring the last word on the policy to be
    // a DROP keeps a future migration from quietly reintroducing it.
    const migrationDir = join(apiRoot, "supabase/migrations");
    const statements = readdirSync(migrationDir)
      .filter((file) => file.endsWith(".sql"))
      .sort() // filenames are timestamps → lexical order is apply order
      .flatMap((file) =>
        // Comments quote the policy to explain it; only real statements count.
        (readFileSync(join(migrationDir, file), "utf-8")
          .replace(/--[^\n]*/g, "")
          .match(/(?:create|drop)\s+policy[^;]*"shared_decks_visible"[^;]*;/gi) ?? [])
          .map((statement) => ({ file, statement: statement.toLowerCase() })),
      );

    expect(statements.length).toBeGreaterThanOrEqual(2); // the original CREATE + our DROP
    expect(statements[0]?.statement).toMatch(/^create\s+policy/);
    expect(statements.at(-1)?.statement).toMatch(/^drop\s+policy/);
  });
});
