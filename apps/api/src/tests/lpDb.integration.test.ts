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
drop table if exists lp_transactions, rewards_claimed, streak_freeze_uses, monthly_lp_grants, profiles cascade;
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
  broken_streak int not null default 0,
  broken_on date,
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
create table friend_connections (
  user_id uuid not null references profiles(id) on delete cascade,
  friend_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);
`;

const USER = "00000000-0000-4000-8000-000000000001";
const FRIEND = "00000000-0000-4000-8000-000000000002";

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
    await client.query(loadMigration("20260713110000_monthly_lp_grant.sql"));
    await client.query(loadMigration("20260713140000_streak_freeze.sql"));
    await client.query(loadMigration("20260714120000_streak_repair.sql"));
    await client.query(loadMigration("20260714130000_friend_streaks.sql"));
    await client.query(loadMigration("20260715120000_repair_window_from_last_learn.sql"));
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

  // ── streak repair: broken-marker recording + purchase_streak_repair ──────
  describe("streak repair", () => {
    async function profile() {
      const { rows } = await client.query(
        "select current_streak, longest_streak, broken_streak, to_char(broken_on,'YYYY-MM-DD') as broken_on, lp_balance from profiles where id = $1",
        [USER]
      );
      return rows[0];
    }
    async function seedLost(opts: { streak: number; lastDaysAgo: number; freezes?: number }) {
      await client.query(
        `insert into profiles (id, lp_balance, current_streak, longest_streak, last_review_date, streak_freezes)
         values ($1, 100, $2, greatest($2,0), current_date - $3::int, $4)`,
        [USER, opts.streak, opts.lastDaysAgo, opts.freezes ?? 0]
      );
    }

    it("records a repair marker at the last alive day when a real streak (>= 2) is lost", async () => {
      // Last learned 2 days ago (missed 1 day, no freeze) → resets today.
      await seedLost({ streak: 12, lastDaysAgo: 2 });
      await client.query("select * from update_streak_after_review($1, current_date)", [USER]);
      const p = await profile();
      expect(p.current_streak).toBe(1);
      expect(p.broken_streak).toBe(12);
      // Window counts from the last alive day, NOT the return day.
      const { rows } = await client.query("select to_char(current_date - 2, 'YYYY-MM-DD') as d");
      expect(p.broken_on).toBe(rows[0].d);
    });

    it("does not record a marker when there was no real streak to lose", async () => {
      await seedLost({ streak: 1, lastDaysAgo: 5 });
      await client.query("select * from update_streak_after_review($1, current_date)", [USER]);
      const p = await profile();
      expect(p.broken_streak).toBe(0);
      expect(p.broken_on).toBeNull();
    });

    it("keeps the marker alive across a following review, so the window survives", async () => {
      // Streak was lost and reset to 1 today; marker at the last alive day (2 days ago).
      await client.query(
        `insert into profiles (id, lp_balance, current_streak, longest_streak, last_review_date, broken_streak, broken_on)
         values ($1, 100, 1, 12, current_date, 12, current_date - 2)`,
        [USER]
      );
      // A consecutive-day review tomorrow must not wipe the marker.
      await client.query("select * from update_streak_after_review($1, current_date + 1)", [USER]);
      const p = await profile();
      expect(p.current_streak).toBe(2);
      expect(p.broken_streak).toBe(12);
    });

    it("repairs within the window: restores lost + rebuilt run, deducts LP, writes ledger", async () => {
      // Last alive 2 days ago → still inside the 2-day window.
      await client.query(
        `insert into profiles (id, lp_balance, current_streak, longest_streak, broken_streak, broken_on)
         values ($1, 100, 1, 12, 12, current_date - 2)`,
        [USER]
      );
      const { rows } = await client.query("select * from purchase_streak_repair($1, 40, current_date)", [USER]);
      expect(rows[0]).toMatchObject({ allowed: true, error_code: null, new_balance: 60, new_streak: 13 });
      const p = await profile();
      expect(p.current_streak).toBe(13);
      expect(p.longest_streak).toBe(13);
      expect(p.broken_streak).toBe(0);
      const led = await client.query("select type, amount, reason from lp_transactions where user_id = $1", [USER]);
      expect(led.rows).toEqual([{ type: "spent", amount: -40, reason: "streak_repair" }]);
    });

    it("rejects with no_repair when the window has passed", async () => {
      await client.query(
        `insert into profiles (id, lp_balance, current_streak, longest_streak, broken_streak, broken_on)
         values ($1, 100, 3, 12, 12, current_date - 3)`,
        [USER]
      );
      const { rows } = await client.query("select * from purchase_streak_repair($1, 40, current_date)", [USER]);
      expect(rows[0]).toMatchObject({ allowed: false, error_code: "no_repair" });
      const p = await profile();
      expect(p.lp_balance).toBe(100); // untouched
    });

    it("rejects with no_repair when there is nothing to repair", async () => {
      await client.query("insert into profiles (id, lp_balance) values ($1, 100)", [USER]);
      const { rows } = await client.query("select * from purchase_streak_repair($1, 40, current_date)", [USER]);
      expect(rows[0].allowed).toBe(false);
      expect(rows[0].error_code).toBe("no_repair");
    });

    it("rejects with insufficient_lp when the balance is too low", async () => {
      await client.query(
        `insert into profiles (id, lp_balance, current_streak, longest_streak, broken_streak, broken_on)
         values ($1, 30, 1, 12, 12, current_date - 2)`,
        [USER]
      );
      const { rows } = await client.query("select * from purchase_streak_repair($1, 40, current_date)", [USER]);
      expect(rows[0]).toMatchObject({ allowed: false, error_code: "insufficient_lp" });
      const p = await profile();
      expect(p.broken_streak).toBe(12); // still repairable later
    });

    it("a long absence is NOT repairable, even right after returning (Lara's fix)", async () => {
      // Gone 10 days, then return and learn today → resets, marker at the last
      // alive day (10 days ago). The window is long gone, so no buying it back.
      await seedLost({ streak: 12, lastDaysAgo: 10 });
      await client.query("select * from update_streak_after_review($1, current_date)", [USER]);
      const p = await profile();
      expect(p.broken_streak).toBe(12);
      const { rows: on } = await client.query("select to_char(current_date - 10, 'YYYY-MM-DD') as d");
      expect(p.broken_on).toBe(on[0].d);

      const { rows } = await client.query("select * from purchase_streak_repair($1, 40, current_date)", [USER]);
      expect(rows[0]).toMatchObject({ allowed: false, error_code: "no_repair" });
      expect((await profile()).lp_balance).toBe(100); // untouched
    });
  });

  // ── friend streaks: invite/accept + shared-day progression + freeze save ──
  describe("friend streaks", () => {
    const LOW = USER < FRIEND ? USER : FRIEND;
    const HIGH = USER < FRIEND ? FRIEND : USER;

    async function seedPair(opts?: { userFreezes?: number; friendFreezes?: number }) {
      await client.query(
        "insert into profiles (id, streak_freezes) values ($1, $2), ($3, $4)",
        [USER, opts?.userFreezes ?? 0, FRIEND, opts?.friendFreezes ?? 0]
      );
      await client.query(
        "insert into friend_connections (user_id, friend_id) values ($1,$2),($2,$1)",
        [USER, FRIEND]
      );
    }
    async function activePair(opts?: { userFreezes?: number; friendFreezes?: number }) {
      await seedPair(opts);
      await client.query("select invite_friend_streak($1,$2)", [USER, FRIEND]);
      await client.query("select accept_friend_streak($1,$2)", [FRIEND, USER]);
    }
    async function streak() {
      const { rows } = await client.query(
        "select status, current_streak, longest_streak from friend_streaks where user_low=$1 and user_high=$2",
        [LOW, HIGH]
      );
      return rows[0];
    }
    const both = async (day: string) => {
      await client.query(`select mark_friend_streak_day($1, ${day})`, [USER]);
      await client.query(`select mark_friend_streak_day($1, ${day})`, [FRIEND]);
    };

    it("invite requires an existing friendship", async () => {
      await client.query("insert into profiles (id) values ($1),($2)", [USER, FRIEND]);
      const { rows } = await client.query("select invite_friend_streak($1,$2) as r", [USER, FRIEND]);
      expect(rows[0].r).toBe("not_friends");
    });

    it("invite then accept activates it; only the invitee may accept", async () => {
      await seedPair();
      expect((await client.query("select invite_friend_streak($1,$2) as r", [USER, FRIEND])).rows[0].r).toBe("invited");
      // the inviter cannot accept their own invite
      expect((await client.query("select accept_friend_streak($1,$2) as r", [USER, FRIEND])).rows[0].r).toBe(false);
      // the invitee can
      expect((await client.query("select accept_friend_streak($1,$2) as r", [FRIEND, USER])).rows[0].r).toBe(true);
      expect((await streak()).status).toBe("active");
    });

    it("advances only when both studied the same day", async () => {
      await activePair();
      await client.query("select mark_friend_streak_day($1, current_date)", [USER]);
      expect((await streak()).current_streak).toBe(0); // partner hasn't studied
      await client.query("select mark_friend_streak_day($1, current_date)", [FRIEND]);
      expect((await streak()).current_streak).toBe(1);
    });

    it("counts a consecutive shared day once, ignoring repeat reviews", async () => {
      await activePair();
      await both("current_date");
      await both("current_date + 1");
      await client.query("select mark_friend_streak_day($1, current_date + 1)", [USER]); // repeat
      expect((await streak()).current_streak).toBe(2);
    });

    it("bridges a one-day gap with a partner's freeze and consumes it", async () => {
      await activePair({ friendFreezes: 1 });
      await both("current_date");
      await both("current_date + 2"); // day+1 missed → one shared day gap
      expect((await streak()).current_streak).toBe(2);
      const { rows } = await client.query("select streak_freezes from profiles where id=$1", [FRIEND]);
      expect(rows[0].streak_freezes).toBe(0);
    });

    it("resets to 1 on a one-day gap when no one has a freeze", async () => {
      await activePair();
      await both("current_date");
      await both("current_date + 2");
      expect((await streak()).current_streak).toBe(1);
    });
  });

  // ── grant_monthly_lp: per-(user, period) idempotency (#604) ──────────────
  // The webhook (instant credit on purchase) and the /lp/monthly-grant cron
  // both call this with the calendar month as the period — these tests pin
  // that the second caller in a month can never double-credit.
  describe("grant_monthly_lp", () => {
    it("credits once per period and writes the audited ledger row", async () => {
      await seed(0);
      const first = await client.query(
        "select grant_monthly_lp($1, 'pro', 300, '2026-08') as granted", [USER]
      );
      expect(first.rows[0].granted).toBe(true);
      expect(await balance()).toBe(300);
      const led = await client.query(
        "select type, amount, reason from lp_transactions where user_id = $1", [USER]
      );
      expect(led.rows).toEqual([{ type: "abo_grant", amount: 300, reason: "monthly_pro_2026-08" }]);
    });

    it("the same period again is a no-op (webhook + cron overlap safely)", async () => {
      await seed(0);
      await client.query("select grant_monthly_lp($1, 'pro', 300, '2026-08')", [USER]);
      const dup = await client.query(
        "select grant_monthly_lp($1, 'pro', 300, '2026-08') as granted", [USER]
      );
      expect(dup.rows[0].granted).toBe(false);
      expect(await balance()).toBe(300); // NOT 600
    });

    it("a new month grants again (the annual/lifetime fix, #604)", async () => {
      await seed(0);
      await client.query("select grant_monthly_lp($1, 'lifetime', 300, '2026-08')", [USER]);
      const next = await client.query(
        "select grant_monthly_lp($1, 'lifetime', 300, '2026-09') as granted", [USER]
      );
      expect(next.rows[0].granted).toBe(true);
      expect(await balance()).toBe(600);
    });

    it("two concurrent calls for the same period credit exactly once", async () => {
      await seed(0);
      const { Client } = await import("pg");
      const a = new Client({ connectionString: DATABASE_URL });
      const b = new Client({ connectionString: DATABASE_URL });
      await a.connect();
      await b.connect();
      try {
        const [ra, rb] = await Promise.all([
          a.query("select grant_monthly_lp($1, 'pro', 300, '2026-08') as granted", [USER]),
          b.query("select grant_monthly_lp($1, 'pro', 300, '2026-08') as granted", [USER]),
        ]);
        const granted = [ra.rows[0].granted, rb.rows[0].granted];
        expect(granted.filter(Boolean)).toHaveLength(1); // exactly one credited
        expect(await balance()).toBe(300);
      } finally {
        await a.end();
        await b.end();
      }
    });

    it("a non-positive amount grants nothing and leaves no guard row", async () => {
      await seed(0);
      const { rows } = await client.query(
        "select grant_monthly_lp($1, 'free', 0, '2026-08') as granted", [USER]
      );
      expect(rows[0].granted).toBe(false);
      expect(await balance()).toBe(0);
      const guard = await client.query(
        "select count(*)::int as n from monthly_lp_grants where user_id = $1", [USER]
      );
      expect(guard.rows[0].n).toBe(0);
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
