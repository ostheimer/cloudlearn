/**
 * Integration tests for the LP Postgres functions against a REAL database.
 *
 * The unit tests in lpService.test.ts mock db.rpc, so they only pin the wiring
 * (right RPC name / params / mapping) — the actual SQL bodies (the balance
 * guard `lp_balance >= p_cost`, the row lock, the `on conflict` idempotency)
 * never run. These tests load the real function migrations into a real Postgres
 * and exercise that SQL, including the thing you cannot test with mocks at all:
 * two concurrent spend_lp calls must not both succeed.
 *
 * Skipped automatically when DATABASE_URL is unset (normal local/unit runs).
 * CI sets DATABASE_URL to a throwaway Postgres service — see .github/workflows/ci.yml.
 */

import type { Client as PgClient } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DATABASE_URL = process.env.DATABASE_URL;
const suite = DATABASE_URL ? describe : describe.skip;

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations");
const loadMigration = (file: string) => readFileSync(join(migrationsDir, file), "utf-8");

// Auth-free tables so a bare Postgres can host the LP functions. Mirrors the
// production columns the functions touch, minus the Supabase auth.users FK and
// RLS that the real profiles/lp_transactions/rewards_claimed carry.
const SCHEMA_SETUP = `
create extension if not exists pgcrypto;
do $$ begin
  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end $$;
drop table if exists lp_transactions, rewards_claimed, streak_freeze_uses, profiles cascade;
create table profiles (
  id uuid primary key,
  lp_balance int not null default 10,
  lp_earned_today int not null default 0,
  lp_ads_today int not null default 0,
  lp_period_start date not null default current_date,
  lp_rewarded_review_count int not null default 0,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_review_date date,
  daily_goal int not null default 10,
  updated_at timestamptz not null default now()
);
create table lp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  amount int not null,
  reason text,
  created_at timestamptz not null default now()
);
create table rewards_claimed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  reward_key text not null,
  lp_granted int not null default 0,
  claimed_at timestamptz not null default now(),
  unique (user_id, reward_key)
);
`;

const USER = "00000000-0000-4000-8000-000000000001";

suite("LP SQL functions (real Postgres integration)", () => {
  let client: PgClient;

  beforeAll(async () => {
    const { Client } = await import("pg");
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    await client.query(SCHEMA_SETUP);
    // Load the REAL function definitions from the migrations (no drift vs prod).
    await client.query(loadMigration("20260404130000_atomic_lp_operations.sql"));
    await client.query(loadMigration("20260708150000_atomic_claim_milestone.sql"));
    await client.query(loadMigration("20260709120000_idempotent_lp_purchase.sql"));
    await client.query(loadMigration("20260713140000_streak_freeze.sql"));
  });

  afterEach(async () => {
    await client.query("truncate profiles cascade");
  });

  afterAll(async () => {
    if (client) await client.end();
  });

  async function seed(balance: number) {
    await client.query("insert into profiles (id, lp_balance) values ($1, $2)", [USER, balance]);
  }
  async function balance(): Promise<number> {
    const { rows } = await client.query("select lp_balance from profiles where id = $1", [USER]);
    return rows[0].lp_balance;
  }

  // ── spend_lp: the balance guard ──────────────────────────────────────────
  describe("spend_lp", () => {
    it("deducts and records the ledger row when balance suffices", async () => {
      await seed(30);
      const { rows } = await client.query("select * from spend_lp($1, 10, 'aiScan')", [USER]);
      expect(rows[0]).toMatchObject({ allowed: true, new_balance: 20 });
      expect(await balance()).toBe(20);
      const led = await client.query("select type, amount from lp_transactions where user_id = $1", [USER]);
      expect(led.rows).toEqual([{ type: "spent", amount: -10 }]);
    });

    it("rejects and leaves the balance untouched when it is too low", async () => {
      await seed(5);
      const { rows } = await client.query("select * from spend_lp($1, 10, 'aiScan')", [USER]);
      expect(rows[0]).toMatchObject({ allowed: false, new_balance: 5 });
      expect(await balance()).toBe(5);
      const led = await client.query("select count(*)::int as n from lp_transactions where user_id = $1", [USER]);
      expect(led.rows[0].n).toBe(0);
    });

    // The whole point of #133: mocks cannot test this.
    it("two concurrent spends of a balance that only covers one → exactly one wins, never negative", async () => {
      await seed(10); // covers a single cost-10 spend, not two
      const { Client } = await import("pg");
      const a = new Client({ connectionString: DATABASE_URL });
      const b = new Client({ connectionString: DATABASE_URL });
      await a.connect();
      await b.connect();
      try {
        const [ra, rb] = await Promise.all([
          a.query("select * from spend_lp($1, 10, 'aiScan')", [USER]),
          b.query("select * from spend_lp($1, 10, 'aiScan')", [USER]),
        ]);
        const allowed = [ra.rows[0].allowed, rb.rows[0].allowed];
        expect(allowed.filter(Boolean)).toHaveLength(1); // exactly one succeeded
        expect(await balance()).toBe(0); // deducted once, never -10
      } finally {
        await a.end();
        await b.end();
      }
    });
  });

  // ── claim_milestone_lp: guard + credit in one tx ─────────────────────────
  describe("claim_milestone_lp", () => {
    it("credits on first claim, then is an idempotent no-op", async () => {
      await seed(0);
      const first = await client.query("select * from claim_milestone_lp($1, 'first_deck', 10)", [USER]);
      expect(first.rows[0]).toMatchObject({ granted: 10, already_claimed: false, new_balance: 10 });

      const second = await client.query("select * from claim_milestone_lp($1, 'first_deck', 10)", [USER]);
      expect(second.rows[0]).toMatchObject({ granted: 0, already_claimed: true, new_balance: 10 });

      expect(await balance()).toBe(10); // credited exactly once
    });
  });

  // ── purchase_streak_freeze: balance guard + ownership cap in one tx ──────
  describe("purchase_streak_freeze", () => {
    async function freezes(): Promise<number> {
      const { rows } = await client.query("select streak_freezes from profiles where id = $1", [USER]);
      return rows[0].streak_freezes;
    }

    it("deducts LP, increments the counter and writes the ledger row", async () => {
      await seed(30);
      const { rows } = await client.query("select * from purchase_streak_freeze($1, 20, 2)", [USER]);
      expect(rows[0]).toMatchObject({ allowed: true, error_code: null, new_balance: 10, freezes: 1 });
      expect(await balance()).toBe(10);
      expect(await freezes()).toBe(1);
      const led = await client.query("select type, amount, reason from lp_transactions where user_id = $1", [USER]);
      expect(led.rows).toEqual([{ type: "spent", amount: -20, reason: "streak_freeze" }]);
    });

    it("rejects with insufficient_lp and leaves everything untouched", async () => {
      await seed(10);
      const { rows } = await client.query("select * from purchase_streak_freeze($1, 20, 2)", [USER]);
      expect(rows[0]).toMatchObject({ allowed: false, error_code: "insufficient_lp", new_balance: 10, freezes: 0 });
      expect(await balance()).toBe(10);
      expect(await freezes()).toBe(0);
      const led = await client.query("select count(*)::int as n from lp_transactions where user_id = $1", [USER]);
      expect(led.rows[0].n).toBe(0);
    });

    it("rejects with max_owned at the cap even when LP would suffice", async () => {
      await seed(100);
      await client.query("update profiles set streak_freezes = 2 where id = $1", [USER]);
      const { rows } = await client.query("select * from purchase_streak_freeze($1, 20, 2)", [USER]);
      expect(rows[0]).toMatchObject({ allowed: false, error_code: "max_owned", new_balance: 100, freezes: 2 });
      expect(await balance()).toBe(100);
      expect(await freezes()).toBe(2);
    });

    it("two concurrent purchases with LP for only one → exactly one wins", async () => {
      await seed(20); // covers a single cost-20 purchase, not two
      const { Client } = await import("pg");
      const a = new Client({ connectionString: DATABASE_URL });
      const b = new Client({ connectionString: DATABASE_URL });
      await a.connect();
      await b.connect();
      try {
        const [ra, rb] = await Promise.all([
          a.query("select * from purchase_streak_freeze($1, 20, 2)", [USER]),
          b.query("select * from purchase_streak_freeze($1, 20, 2)", [USER]),
        ]);
        const allowed = [ra.rows[0].allowed, rb.rows[0].allowed];
        expect(allowed.filter(Boolean)).toHaveLength(1);
        expect(await balance()).toBe(0); // charged once, never -20
        expect(await freezes()).toBe(1); // credited once
      } finally {
        await a.end();
        await b.end();
      }
    });
  });

  // ── update_streak_after_review: streak rules incl. freeze consumption ────
  describe("update_streak_after_review", () => {
    // Seeds the streak state relative to "today" as Postgres sees it, and the
    // tests call the function with current_date — so day arithmetic stays
    // entirely inside one clock and cannot flake around midnight.
    async function seedStreak(opts: {
      streak?: number; longest?: number; lastDaysAgo?: number | null; freezes?: number;
    }) {
      await client.query(
        `insert into profiles (id, current_streak, longest_streak, last_review_date, streak_freezes)
         values ($1, $2, $3, case when $4::int is null then null else current_date - $4::int end, $5)`,
        [USER, opts.streak ?? 0, opts.longest ?? 0, opts.lastDaysAgo ?? null, opts.freezes ?? 0]
      );
    }
    async function callUpdate() {
      const { rows } = await client.query(
        "select * from update_streak_after_review($1, current_date)", [USER]
      );
      return rows[0];
    }
    async function freezeUses(): Promise<string[]> {
      const { rows } = await client.query(
        "select to_char(used_on, 'YYYY-MM-DD') as used_on from streak_freeze_uses where user_id = $1", [USER]
      );
      return rows.map((r) => r.used_on);
    }

    it("first ever review starts the streak at 1", async () => {
      await seedStreak({ lastDaysAgo: null });
      expect(await callUpdate()).toMatchObject({ current_streak: 1, longest_streak: 1, freeze_used: false });
    });

    it("a second review on the same day changes nothing", async () => {
      await seedStreak({ streak: 5, longest: 8, lastDaysAgo: 0, freezes: 1 });
      expect(await callUpdate()).toMatchObject({ current_streak: 5, longest_streak: 8, freeze_used: false });
    });

    it("a consecutive day increments the streak and the longest record", async () => {
      await seedStreak({ streak: 8, longest: 8, lastDaysAgo: 1 });
      expect(await callUpdate()).toMatchObject({ current_streak: 9, longest_streak: 9, freeze_used: false });
    });

    it("one missed day with a freeze → freeze consumed, streak continues, covered day recorded", async () => {
      await seedStreak({ streak: 5, longest: 8, lastDaysAgo: 2, freezes: 2 });
      const row = await callUpdate();
      expect(row).toMatchObject({ current_streak: 6, longest_streak: 8, streak_freezes: 1, freeze_used: true });
      const { rows } = await client.query("select to_char(current_date - 1, 'YYYY-MM-DD') as d");
      expect(await freezeUses()).toEqual([rows[0].d]); // the missed day, not today
    });

    it("one missed day without a freeze → streak resets to 1", async () => {
      await seedStreak({ streak: 5, longest: 8, lastDaysAgo: 2, freezes: 0 });
      expect(await callUpdate()).toMatchObject({ current_streak: 1, longest_streak: 8, freeze_used: false });
    });

    it("two missed days → streak resets, freezes stay untouched", async () => {
      await seedStreak({ streak: 5, longest: 8, lastDaysAgo: 3, freezes: 2 });
      const row = await callUpdate();
      expect(row).toMatchObject({ current_streak: 1, longest_streak: 8, streak_freezes: 2, freeze_used: false });
      expect(await freezeUses()).toEqual([]);
    });
  });

  // ── grant_lp_purchase: partial-unique-index idempotency ──────────────────
  describe("grant_lp_purchase", () => {
    it("credits once per purchase reason; a duplicate delivery is a no-op", async () => {
      await seed(0);
      const first = await client.query("select * from grant_lp_purchase($1, 300, 'purchase_tx1')", [USER]);
      expect(first.rows[0]).toMatchObject({ granted: 300, already_granted: false, new_balance: 300 });

      const dup = await client.query("select * from grant_lp_purchase($1, 300, 'purchase_tx1')", [USER]);
      expect(dup.rows[0]).toMatchObject({ granted: 0, already_granted: true, new_balance: 300 });

      expect(await balance()).toBe(300); // NOT 600
    });

    it("still credits a different transaction", async () => {
      await seed(0);
      await client.query("select * from grant_lp_purchase($1, 300, 'purchase_tx1')", [USER]);
      const other = await client.query("select * from grant_lp_purchase($1, 100, 'purchase_tx2')", [USER]);
      expect(other.rows[0]).toMatchObject({ granted: 100, already_granted: false, new_balance: 400 });
    });
  });
});
