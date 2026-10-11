import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const connectionString = process.env.CLOUDLEARN_OCCLUSION_TEST_DATABASE_URL;
const parentConnectionString = process.env.DATABASE_URL;
let db = new Client({ connectionString });
let temporaryDatabase: string | null = null;
const user = "20000000-0000-4000-8000-000000000731";
const foreign = "20000000-0000-4000-8000-000000000732";
const deck = "10000000-0000-4000-8000-000000000731";
const a = "30000000-0000-4000-8000-000000000731";
const b = "30000000-0000-4000-8000-000000000732";
const sibling = "30000000-0000-4000-8000-000000000733";
const other = "30000000-0000-4000-8000-000000000734";
const regions = [{ x: .1, y: .1, w: .2, h: .2, label: "Alpha" }, { x: .6, y: .4, w: .2, h: .2, label: "Beta" }];
const region = (index: number, cardIds: string[]) => ({ ...regions[index], cardIds });
async function snapshot() {
  const r = await db.query("select id, back, extra_data as \"extraData\" from cards where user_id=$1 and deck_id=$2 and source_image_url='user/image.png' and card_type='occlusion' and deleted_at is null order by id", [user, deck]);
  return r.rows;
}
async function save(next: unknown[], expected: unknown[] | null = null, owner = user, capacity = 2000) {
  const r = await db.query("select edit_occlusion_image($1,$2,'user/image.png',$3::jsonb,$4::jsonb,$5) as result", [owner, deck, JSON.stringify(expected ?? await snapshot()), JSON.stringify(next), capacity]);
  return r.rows[0].result;
}

describe.skipIf(!connectionString && !parentConnectionString)("atomic occlusion SQL on disposable PostgreSQL (#731)", () => {
  beforeAll(async () => {
    let testConnectionString = connectionString;
    // CI already provides disposable PostgreSQL. Use a separate fresh database
    // so these destructive fixture resets cannot touch the LP tests' database.
    if (!testConnectionString && parentConnectionString) {
      const parent = new URL(parentConnectionString);
      if (!["localhost", "127.0.0.1"].includes(parent.hostname)) throw new Error("Only local disposable PostgreSQL is allowed");
      temporaryDatabase = `cloudlearn_occlusion_test_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const admin = new Client({ connectionString: parentConnectionString });
      await admin.connect();
      try { await admin.query(`create database ${temporaryDatabase}`); } finally { await admin.end(); }
      parent.pathname = `/${temporaryDatabase}`;
      testConnectionString = parent.toString();
    }
    const url = new URL(testConnectionString!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.startsWith("/cloudlearn_occlusion_test_")) throw new Error("Only the disposable local runner database is allowed");
    db = new Client({ connectionString: testConnectionString });
    await db.connect();
    await db.query("create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as 'select null::uuid'; do $$ begin create role anon; exception when duplicate_object then null; end $$; do $$ begin create role authenticated; exception when duplicate_object then null; end $$; do $$ begin create role service_role; exception when duplicate_object then null; end $$;");
    for (const file of ["20260209230000_init.sql", "20260211120000_add_card_difficulty_tags.sql", "20260211180000_add_card_starred.sql", "20260212000000_add_fsrs_fields.sql", "20261009220000_edit_occlusion_image.sql"]) {
      await db.query(readFileSync(fileURLToPath(new URL(`../../supabase/migrations/${file}`, import.meta.url)), "utf8"));
    }
  });
  afterAll(async () => {
    await db.end();
    if (temporaryDatabase && parentConnectionString) {
      const admin = new Client({ connectionString: parentConnectionString });
      await admin.connect();
      try { await admin.query(`drop database ${temporaryDatabase}`); } finally { await admin.end(); }
    }
  });
  beforeEach(async () => {
    await db.query("truncate cards, review_logs, decks, profiles, auth.users cascade");
    await db.query("insert into auth.users(id) values($1),($2);", [user, foreign]);
    await db.query("insert into profiles(id) values($1),($2)", [user, foreign]);
    await db.query("insert into decks(id,user_id,title) values($1,$2,'Synthetic')", [deck, user]);
    for (const [id, path, target, label] of [[a, "user/image.png", 0, "Alpha"], [b, "user/image.png", 1, "Beta"], [sibling, "user/image.png", 1, "Beta"], [other, "user/other.png", 0, "Other"]] as const) {
      await db.query("insert into cards(id,user_id,deck_id,front,back,card_type,source_image_url,extra_data,starred,fsrs_reps,fsrs_stability,fsrs_due) values($1,$2,$3,'Original question',$4,'occlusion',$5,$6,true,17,42,'2099-01-01T00:00:00Z')", [id, user, deck, label, path, { regions, hideIndex: target, custom: "keep" }]);
    }
    await db.query("insert into review_logs(card_id,user_id,idempotency_key,rating) values($1,$2,'review-preserved',3)", [b, user]);
  });
  it("edits/reindexes siblings, adds a region and soft-deletes only the removed region", async () => {
    const untouched = (await db.query("select * from cards where id=$1", [other])).rows[0];
    expect(await save([{ ...region(1, [b, sibling]), x: .5, label: "Beta changed" }, { ...region(0, []), label: "New" }])).toEqual({ updated: 2, created: 1, deleted: 1 });
    const retained = (await db.query("select * from cards where id=$1", [b])).rows[0];
    expect(retained).toMatchObject({ id: b, front: "Original question", back: "Beta changed", source_image_url: "user/image.png", starred: true, fsrs_reps: 17, fsrs_stability: 42, extra_data: { hideIndex: 0, custom: "keep" } });
    expect(retained.fsrs_due.toISOString()).toBe("2099-01-01T00:00:00.000Z");
    expect((await db.query("select * from cards where id=$1", [a])).rows[0].deleted_at).not.toBeNull();
    expect((await db.query("select * from cards where id=$1", [other])).rows[0]).toEqual(untouched);
    expect((await db.query("select count(*)::int as n from review_logs")).rows[0].n).toBe(1);
    const active = await snapshot();
    expect(active).toHaveLength(3);
    expect(active.every(c => c.extraData.regions.length === 2)).toBe(true);
  });
  it("rejects stale snapshots and changed membership without any write", async () => {
    const expected = await snapshot();
    await db.query("update cards set back='Changed elsewhere' where id=$1", [b]);
    const before = await snapshot();
    await expect(save([region(0, [a]), region(1, [b, sibling])], expected)).rejects.toThrow("OCCLUSION_CONFLICT");
    expect(await snapshot()).toEqual(before);
  });
  it("allows new reviews between load/save and keeps the latest learning state", async () => {
    const expected = await snapshot();
    await db.query("update cards set fsrs_reps=18,fsrs_stability=60 where id=$1", [b]);
    await save([region(0, [a]), region(1, [b, sibling])], expected);
    expect((await db.query("select fsrs_reps,fsrs_stability from cards where id=$1", [b])).rows[0]).toEqual({ fsrs_reps: 18, fsrs_stability: 60 });
  });
  it("rejects foreign users and IDs, duplicate mappings, invalid geometry and capacity atomically", async () => {
    const before = await snapshot();
    await expect(save([region(0, [a])], before, foreign)).rejects.toThrow("DECK_NOT_FOUND");
    await expect(save([region(0, [other])])).rejects.toThrow("INVALID_REGIONS");
    await expect(save([region(0, [a]), region(1, [a])])).rejects.toThrow("INVALID_REGIONS");
    await expect(save([{ ...region(0, [a]), x: .9, w: .2 }])).rejects.toThrow("INVALID_REGIONS");
    await expect(save([region(0, [a]), region(1, [b, sibling]), region(0, [])], null, user, 4)).rejects.toThrow("DECK_FULL");
    expect(await snapshot()).toEqual(before);
  });
  it("rolls back earlier updates when a later insert fails", async () => {
    const before = await snapshot();
    await db.query("create function reject_occlusion_test_insert() returns trigger language plpgsql as $$ begin if new.back = 'Reject insert' then raise exception 'Synthetic insert failure'; end if; return new; end $$; create trigger reject_occlusion_test_insert before insert on cards for each row execute function reject_occlusion_test_insert()");
    try {
      await expect(save([{ ...region(0, [a]), label: "Must roll back" }, { ...region(1, []), label: "Reject insert" }])).rejects.toThrow("Synthetic insert failure");
    } finally { await db.query("drop trigger reject_occlusion_test_insert on cards; drop function reject_occlusion_test_insert()"); }
    expect(await snapshot()).toEqual(before);
  });
  it("supports removal of every region without deleting review logs or the stored image", async () => {
    expect(await save([])).toEqual({ updated: 0, created: 0, deleted: 3 });
    expect(await snapshot()).toEqual([]);
    expect((await db.query("select count(*)::int as n from cards where source_image_url='user/image.png'")).rows[0].n).toBe(3);
    expect((await db.query("select count(*)::int as n from review_logs")).rows[0].n).toBe(1);
  });
  it("does not grant browser roles access to the transaction", async () => {
    const r = await db.query("select has_function_privilege('authenticated','edit_occlusion_image(uuid,uuid,text,jsonb,jsonb,integer)','execute') as browser, has_function_privilege('service_role','edit_occlusion_image(uuid,uuid,text,jsonb,jsonb,integer)','execute') as server");
    expect(r.rows[0]).toEqual({ browser: false, server: true });
  });
});
