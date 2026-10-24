import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
const url = process.env.DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("#756 real atomic budget and claims", () => {
  let db: Client;
  beforeAll(async () => {
    if (!["127.0.0.1", "localhost", "postgres"].includes(new URL(url!).hostname)) throw new Error("Only disposable local/CI Postgres is allowed");
    db = new Client({ connectionString: url }); await db.connect();
    await db.query(`do $$ begin
      if not exists(select from pg_roles where rolname='service_role') then create role service_role; end if;
      if not exists(select from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if;
    end $$;`);
    const dir = fileURLToPath(new URL("../../supabase/migrations/", import.meta.url));
    const file = readdirSync(dir).find(f => f.endsWith("_gemini_budget_and_request_claims.sql"));
    if (file) await db.query(`drop table if exists gemini_budget_config,gemini_budget_periods,gemini_budget_reservations,ai_request_claims cascade;
      drop function if exists reserve_gemini_budget(text,bigint,bigint),settle_gemini_budget(uuid,bigint,bigint),claim_ai_request(text,uuid,text),complete_ai_request(text,uuid,jsonb),release_ai_request(text,uuid);`);
    if (file) await db.query(readFileSync(dir + file, "utf8"));
  });
  beforeEach(async () => {
    // Before the migration this intentionally fails: the protection is absent.
    await db.query("truncate gemini_budget_periods, gemini_budget_reservations, ai_request_claims");
    await db.query(`update gemini_budget_config set enabled=true, provider_project_id='local-fixture', daily_limit_microusd=100, monthly_limit_microusd=100, input_price_microusd_per_million=1000000, output_price_microusd_per_million=1000000 where id=1`);
  });
  afterAll(async () => { await db?.end(); });
  const reserve = async (client = db, input = 60, output = 0) => (await client.query("select reserve_gemini_budget('gemini-3-flash-preview', $1, $2) as r", [input, output])).rows[0].r;
  it("rejects exhausted day with no partial month debit", async () => {
    expect((await reserve()).status).toBe("reserved"); expect((await reserve()).status).toBe("exhausted");
    expect((await db.query("select used_microusd from gemini_budget_periods order by kind")).rows.map(r => Number(r.used_microusd))).toEqual([60, 60]);
  });
  it("rejects exhausted month even with a fresh day", async () => { await db.query("update gemini_budget_config set monthly_limit_microusd=50"); expect((await reserve()).status).toBe("exhausted"); expect((await db.query("select sum(used_microusd) as n from gemini_budget_periods")).rows[0].n).toBe("0"); });
  it("serializes different connections competing for the last capacity", async () => {
    const peer = new Client({ connectionString: url }); await peer.connect();
    try { const results = await Promise.all([reserve(), reserve(peer)]); expect(results.map(r => r.status).sort()).toEqual(["exhausted", "reserved"]); } finally { await peer.end(); }
  });
  it("settles once with snapshotted prices and original periods", async () => {
    const r = await reserve(); await db.query("update gemini_budget_config set input_price_microusd_per_million=9000000");
    await db.query("select settle_gemini_budget($1, 10, 20)", [r.reservationId]); await db.query("select settle_gemini_budget($1, 10, 20)", [r.reservationId]);
    expect((await db.query("select used_microusd from gemini_budget_periods order by kind")).rows.map(r => Number(r.used_microusd))).toEqual([30, 30]);
  });
  it("retains unknown failed attempts and charges each retry", async () => { await reserve(); expect((await reserve()).status).toBe("exhausted"); expect((await db.query("select status from gemini_budget_reservations")).rows[0].status).toBe("reserved"); });
  it("halts new calls on overrun and records the whole actual cost", async () => { const r = await reserve(); await db.query("select settle_gemini_budget($1, 100, 20)", [r.reservationId]); expect((await reserve()).status).toBe("disabled"); expect((await db.query("select used_microusd from gemini_budget_periods limit 1")).rows[0].used_microusd).toBe("120"); });
  it("requires activation, project and positive budgets", async () => { await db.query("update gemini_budget_config set provider_project_id=null"); expect((await reserve()).status).toBe("disabled"); });
  it("allows exactly one claimant across connections and fences completion", async () => {
    const peer = new Client({ connectionString: url }); await peer.connect();
    const owners = [crypto.randomUUID(), crypto.randomUUID()];
    try {
      const claim = (c: Client, owner: string) => c.query("select claim_ai_request('test-key',$1,'test-fingerprint') as r", [owner]);
      const results = await Promise.all([claim(db, owners[0]!), claim(peer, owners[1]!)]);
      expect(results.map(x => x.rows[0].r.status).sort()).toEqual(["claimed", "in_progress"]);
      const winner = results[0]!.rows[0].r.status === "claimed" ? 0 : 1;
      expect((await db.query("select complete_ai_request('test-key',$1,'{}') as ok", [owners[1-winner]])).rows[0].ok).toBe(false);
      expect((await db.query("select complete_ai_request('test-key',$1,'{\"cards\":[]}') as ok", [owners[winner]])).rows[0].ok).toBe(true);
      expect((await claim(db, crypto.randomUUID())).rows[0].r).toEqual({ status: "complete", response: { cards: [] } });
    } finally { await peer.end(); }
  });
  it("blocks simultaneous identical content even with different client keys", async () => {
    const first = await db.query("select claim_ai_request('key-1',$1,'same-content') as r", [crypto.randomUUID()]);
    const second = await db.query("select claim_ai_request('key-2',$1,'same-content') as r", [crypto.randomUUID()]);
    expect(first.rows[0].r.status).toBe("claimed"); expect(second.rows[0].r.status).toBe("in_progress");
    await db.query("update ai_request_claims set created_at=now()-interval '2 days'");
    expect((await db.query("select claim_ai_request('key-2',$1,'same-content') as r", [crypto.randomUUID()])).rows[0].r.status).toBe("in_progress");
  });
  it("fails closed with corrupt counters and rolls back missing-period settlement", async () => {
    const r = await reserve(); await db.query("delete from gemini_budget_periods where kind='month'");
    await expect(reserve()).rejects.toThrow("Budget counter mismatch");
    await expect(db.query("select settle_gemini_budget($1, 10, 20)", [r.reservationId])).rejects.toThrow("Missing budget periods");
    expect((await db.query("select used_microusd from gemini_budget_periods")).rows[0].used_microusd).toBe("60");
  });
  it("settles old periods without charging the current day or month", async () => {
    const r = await reserve();
    await db.query("update gemini_budget_periods set period_start='2020-01-01'");
    await db.query("update gemini_budget_reservations set day_start='2020-01-01',month_start='2020-01-01'");
    await reserve(db, 40); await db.query("select settle_gemini_budget($1, 10, 20)", [r.reservationId]);
    expect((await db.query("select used_microusd from gemini_budget_periods where period_start='2020-01-01' order by kind")).rows.map(r => Number(r.used_microusd))).toEqual([30, 30]);
    expect((await db.query("select used_microusd from gemini_budget_periods where period_start <> '2020-01-01' order by kind")).rows.map(r => Number(r.used_microusd))).toEqual([40, 40]);
  });
  it("permits the service role through RLS and records rounded token costs", async () => {
    await db.query("update gemini_budget_config set input_price_microusd_per_million=500000,output_price_microusd_per_million=3000000");
    await db.query("set role service_role");
    try { const r = await reserve(db, 1, 1); expect(r.status).toBe("reserved");
      await db.query("select settle_gemini_budget($1, 1, 0)", [r.reservationId]);
      expect((await db.query("select used_microusd from gemini_budget_periods limit 1")).rows[0].used_microusd).toBe("1");
    } finally { await db.query("reset role"); }
  });
  it("does not let anonymous or authenticated clients alter budgets or claim jobs", async () => {
    for (const role of ["anon", "authenticated"]) {
      expect((await db.query("select has_function_privilege($1,'reserve_gemini_budget(text,bigint,bigint)','execute') as ok", [role])).rows[0].ok).toBe(false);
      expect((await db.query("select has_table_privilege($1,'gemini_budget_config','update') as ok", [role])).rows[0].ok).toBe(false);
    }
  });
});
