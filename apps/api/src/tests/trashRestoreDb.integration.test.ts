/** Executes the real #702 migration and races independent PostgreSQL connections.
 * DATABASE_URL must point at the disposable test database (also provided by CI).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const DELETED_AT = "2026-07-30T10:00:00.000Z";
const deckId = (i: number) => `22222222-2222-4222-8222-${String(i).padStart(12, "0")}`;

suite("atomic deck restore (real PostgreSQL, #702)", () => {
  const client = new Client({ connectionString: databaseUrl });
  beforeAll(async () => {
    await client.connect();
    for (const role of ["anon", "authenticated", "service_role"]) {
      await client.query(`do $$ begin create role ${role}; exception when duplicate_object then null; end $$;`);
    }
    await client.query(`
      drop table if exists public.cards, public.decks cascade;
      create table public.decks (
        id uuid primary key, user_id uuid not null, deleted_at timestamptz,
        archived_at timestamptz, updated_at timestamptz not null default now()
      );
      create table public.cards (
        id uuid primary key, deck_id uuid not null references public.decks(id) on delete cascade,
        user_id uuid not null, deleted_at timestamptz
      );
    `);
    await client.query(readFileSync(fileURLToPath(new URL(
      "../../supabase/migrations/20260802010000_atomic_deck_restore.sql", import.meta.url
    )), "utf8"));
  });
  afterEach(async () => { await client.query("truncate public.decks cascade"); });
  afterAll(async () => { await client.end(); });

  async function seed(liveCount: number, deletedCount = 1) {
    for (let i = 0; i < liveCount + deletedCount; i++) {
      await client.query("insert into public.decks(id,user_id,deleted_at) values($1,$2,$3)",
        [deckId(i), USER, i < liveCount ? null : DELETED_AT]);
    }
  }
  async function restore(id: string, user = USER, connection = client) {
    const { rows } = await connection.query(
      "select public.restore_deck_with_limit($1,$2,20) as result", [user, id]
    );
    return rows[0].result;
  }

  it("two concurrent restores at 19/20 leave exactly 20 live decks", async () => {
    await seed(19, 2);
    const a = new Client({ connectionString: databaseUrl });
    const b = new Client({ connectionString: databaseUrl });
    await Promise.all([a.connect(), b.connect()]);
    try {
      const results = await Promise.all([restore(deckId(19), USER, a), restore(deckId(20), USER, b)]);
      expect(results.sort()).toEqual(["limit_reached", "restored"]);
      expect((await client.query("select count(*)::int as n from public.decks where deleted_at is null")).rows[0].n).toBe(20);
    } finally { await Promise.all([a.end(), b.end()]); }
  });

  it("concurrent restores of the same deck report one restore and one not_found", async () => {
    await seed(1);
    const a = new Client({ connectionString: databaseUrl });
    const b = new Client({ connectionString: databaseUrl });
    await Promise.all([a.connect(), b.connect()]);
    try {
      expect((await Promise.all([restore(deckId(1), USER, a), restore(deckId(1), USER, b)])).sort())
        .toEqual(["not_found", "restored"]);
    } finally { await Promise.all([a.end(), b.end()]); }
  });

  it("counts archived decks and rejects a restore at capacity without touching cards", async () => {
    await seed(20);
    await client.query("update public.decks set archived_at=now() where deleted_at is null");
    await client.query("insert into public.cards values($1,$2,$3,$4)", [deckId(100), deckId(20), USER, DELETED_AT]);
    expect(await restore(deckId(20))).toBe("limit_reached");
    expect((await client.query("select deleted_at is not null as deleted from public.cards")).rows[0].deleted).toBe(true);
  });

  it("restores only cards with the deck's deletion timestamp and owner", async () => {
    await seed(0);
    await client.query("insert into public.cards values($1,$2,$3,$4),($5,$2,$3,$6),($7,$2,$8,$4)",
      [deckId(100), deckId(0), USER, DELETED_AT, deckId(101), "2026-07-01T10:00:00Z", deckId(102), OTHER]);
    expect(await restore(deckId(0))).toBe("restored");
    expect((await client.query("select id,deleted_at is null as live from public.cards order by id")).rows).toEqual([
      { id: deckId(100), live: true }, { id: deckId(101), live: false }, { id: deckId(102), live: false },
    ]);
    expect(await restore(deckId(0))).toBe("not_found");
  });

  it("does not restore a foreign or missing deck", async () => {
    await seed(0);
    expect(await restore(deckId(0), OTHER)).toBe("not_found");
    expect(await restore(deckId(99))).toBe("not_found");
  });

  it("rolls back card and deck updates together when the deck write fails", async () => {
    await seed(0);
    await client.query("insert into public.cards values($1,$2,$3,$4)", [deckId(100), deckId(0), USER, DELETED_AT]);
    await client.query(`create function public.reject_restore_702() returns trigger language plpgsql as $$
      begin raise exception 'forced deck write failure'; end; $$;
      create trigger reject_restore_702 before update on public.decks for each row execute function public.reject_restore_702();`);
    try {
      await expect(restore(deckId(0))).rejects.toThrow("forced deck write failure");
      expect((await client.query("select deleted_at is not null as deleted from public.cards")).rows[0].deleted).toBe(true);
      expect((await client.query("select deleted_at is not null as deleted from public.decks")).rows[0].deleted).toBe(true);
    } finally {
      await client.query("drop trigger reject_restore_702 on public.decks; drop function public.reject_restore_702()");
    }
  });

  it("allows only service_role to execute the restore RPC", async () => {
    const { rows } = await client.query(`select
      has_function_privilege('anon','public.restore_deck_with_limit(uuid,uuid,integer)','execute') as anon,
      has_function_privilege('authenticated','public.restore_deck_with_limit(uuid,uuid,integer)','execute') as authenticated,
      has_function_privilege('service_role','public.restore_deck_with_limit(uuid,uuid,integer)','execute') as service`);
    expect(rows[0]).toEqual({ anon: false, authenticated: false, service: true });
  });
});
