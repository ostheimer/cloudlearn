/**
 * Restore-Probe — baut die Datenbank ECHT aus den Migrations-Dateien neu auf (#86).
 *
 * Vorher war das hier eine Attrappe: das alte `restore-smoke.sh` hat nur geprüft,
 * ob EINE Datei existiert, und dann "Simulated restore check passed" gemeldet.
 * Diese Probe beantwortet stattdessen die echte Frage:
 *
 *   "Wenn die Datenbank weg ist — lässt sie sich aus unseren Dateien wieder
 *    aufbauen, und steht danach alles, was die App zum Leben braucht?"
 *
 * Ablauf:
 *   1. Auf einem Wegwerf-Postgres eine frische, leere Datenbank anlegen.
 *   2. Die Supabase-Attrappen einspielen (siehe SUPABASE_STUB) — die Teile, die
 *      in Produktion von Supabase selbst kommen, nicht aus unseren Dateien.
 *   3. ALLE Migrationen aus apps/api/supabase/migrations der Reihe nach anwenden.
 *   4. Nachsehen, ob die tragenden Tabellen und Funktionen wirklich da sind und
 *      ob auf jeder eigenen Tabelle Row Level Security aktiv ist.
 *   5. Die Wegwerf-Datenbank wieder löschen.
 *
 * Die Produktions-Datenbank wird dabei NICHT angefasst — weder lesend noch
 * schreibend. DATABASE_URL muss auf einen Wegwerf-Server zeigen (CI-Service oder
 * lokaler Docker-Container), niemals auf Produktion; das Skript weigert sich,
 * gegen eine Supabase-Adresse zu laufen.
 *
 * Was diese Probe NICHT beweist: dass die Sicherungskopie der echten DATEN bei
 * Supabase zurückgeholt werden kann, dass ein Vercel-Rollback klappt, dass
 * RevenueCat-Webhooks und signierte Bild-Links funktionieren. Das bleibt
 * Handarbeit — siehe docs/runbooks/restore-test.md.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../apps/api/supabase/migrations"
);

/**
 * Stand-ins für die Teile, die in Produktion Supabase mitbringt (auth, storage,
 * vault, pg_cron) und die unsere Migrationen voraussetzen. Ohne sie liefe der
 * Wiederaufbau ins Leere, obwohl unsere eigenen Dateien in Ordnung sind.
 *
 * Bewusst nur so weit ausmodelliert, wie die Migrationen es brauchen: Diese
 * Probe prüft UNSER SQL, nicht die Supabase-Plattform. `storage.foldername`
 * liefert hier z. B. alle Pfad-Teile statt nur der Ordner — für einen reinen
 * Wiederaufbau-Test ohne Datenzugriff macht das keinen Unterschied.
 */
const SUPABASE_STUB = `
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role; end if;
  if not exists (select from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin; end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists vault;
create schema if not exists cron;
create schema if not exists extensions;

create extension if not exists pgcrypto;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid language sql stable as $fn$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$fn$;

create function auth.role() returns text language sql stable as $fn$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$fn$;

create function auth.jwt() returns jsonb language sql stable as $fn$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$fn$;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;

create function storage.foldername(name text) returns text[] language sql immutable as $fn$
  select string_to_array(name, '/')
$fn$;

-- Leer: dadurch überspringt die Cron-Migration ihren Vault-Zweig, genau wie in
-- einem frisch wiederhergestellten Projekt ohne konfigurierte Secrets.
create table vault.decrypted_secrets (
  name text primary key,
  decrypted_secret text
);

-- pg_cron ist hier nicht installiert; die Tabelle muss trotzdem auflösbar sein,
-- weil PL/pgSQL die ganze IF-Bedingung als ein SQL-Statement vorbereitet.
create table cron.job (
  jobid bigserial primary key,
  jobname text,
  schedule text,
  command text
);
`;

/**
 * Die tragenden Tabellen: ohne sie kann die App nichts. Bewusst von Hand
 * gepflegt (statt aus den Migrationen abgeleitet) — eine Liste, die aus der
 * gleichen Quelle stammt wie das Geprüfte, prüft nichts.
 */
const EXPECTED_TABLES = [
  "profiles",
  "decks",
  "cards",
  "review_logs",
  "folders",
  "folder_decks",
  "scans",
  "lp_transactions",
  "rewards_claimed",
  "monthly_lp_grants",
  "streak_freeze_uses",
  "friend_connections",
  "friend_streaks",
  "test_attempts",
  "deleted_accounts",
  "idempotency_keys",
  "rate_limits",
];

/**
 * Die tragenden Datenbank-Funktionen: hier stecken Lernpunkte, Streaks und die
 * Abläufe, die nicht doppelt passieren dürfen. Fehlt eine, wäre die
 * wiederhergestellte Datenbank still kaputt.
 */
const EXPECTED_FUNCTIONS = [
  "add_lp",
  "spend_lp",
  "earn_lp",
  "earn_session_lp",
  "grant_lp_purchase",
  "grant_monthly_lp",
  "grant_ad_ssv_lp",
  "claim_milestone_lp",
  "claim_referral",
  "update_streak_after_review",
  "purchase_streak_freeze",
  "purchase_streak_repair",
  "mark_friend_streak_day",
  "record_test_attempt",
  "check_rate_limit",
  "consume_mathpix_cost",
  "delete_account_data",
];

type Check = { name: string; ok: boolean; detail: string };

function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

/** Verhindert, dass die Probe versehentlich gegen eine echte Supabase-Datenbank läuft. */
export function assertThrowawayTarget(url: string): void {
  const forbidden = ["supabase.co", "supabase.com", "pooler.supabase"];
  const hit = forbidden.find((needle) => url.includes(needle));
  if (hit) {
    throw new Error(
      `DATABASE_URL zeigt auf "${hit}" — das sieht nach einer echten Supabase-Datenbank aus. ` +
        `Die Restore-Probe legt Datenbanken an und löscht sie wieder und darf ausschliesslich ` +
        `gegen einen Wegwerf-Postgres laufen (CI-Service oder lokaler Docker-Container).`
    );
  }
}

function adminUrlFor(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function withClient<T>(url: string, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function replayMigrations(client: Client, files: string[]): Promise<void> {
  await client.query(SUPABASE_STUB);
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    try {
      await client.query(sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Migration "${file}" liess sich auf einer leeren Datenbank nicht anwenden: ${message}\n` +
          `Damit ist der Wiederaufbau aus den Dateien NICHT moeglich — genau das soll diese Probe finden.`,
        { cause: error }
      );
    }
  }
}

async function collectChecks(client: Client, migrationCount: number): Promise<Check[]> {
  const checks: Check[] = [];

  const { rows: tableRows } = await client.query<{ tablename: string; rowsecurity: boolean }>(
    `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`
  );
  const presentTables = new Map(tableRows.map((row) => [row.tablename, row.rowsecurity]));

  const missingTables = EXPECTED_TABLES.filter((table) => !presentTables.has(table));
  checks.push({
    name: "Tragende Tabellen vorhanden",
    ok: missingTables.length === 0,
    detail:
      missingTables.length === 0
        ? `${EXPECTED_TABLES.length} erwartete Tabellen gefunden (${presentTables.size} insgesamt aufgebaut)`
        : `fehlen: ${missingTables.join(", ")}`,
  });

  const { rows: functionRows } = await client.query<{ proname: string }>(
    `select distinct p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'`
  );
  const presentFunctions = new Set(functionRows.map((row) => row.proname));
  const missingFunctions = EXPECTED_FUNCTIONS.filter((fn) => !presentFunctions.has(fn));
  checks.push({
    name: "Tragende Datenbank-Funktionen vorhanden",
    ok: missingFunctions.length === 0,
    detail:
      missingFunctions.length === 0
        ? `${EXPECTED_FUNCTIONS.length} erwartete Funktionen gefunden`
        : `fehlen: ${missingFunctions.join(", ")}`,
  });

  const withoutRls = [...presentTables.entries()]
    .filter(([, enabled]) => !enabled)
    .map(([table]) => table);
  checks.push({
    name: "Row Level Security auf allen eigenen Tabellen aktiv",
    ok: withoutRls.length === 0,
    detail:
      withoutRls.length === 0
        ? `${presentTables.size} Tabellen, alle mit RLS`
        : `ohne RLS: ${withoutRls.join(", ")}`,
  });

  checks.push({
    name: "Alle Migrationen angewendet",
    ok: migrationCount > 0,
    detail: `${migrationCount} Dateien fehlerfrei eingespielt`,
  });

  return checks;
}

export async function run(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      [
        "[restore-smoke] DATABASE_URL fehlt — die Probe braucht einen Wegwerf-Postgres.",
        "",
        "  Lokal starten:",
        "    docker run -d --name clearn-restore-smoke -e POSTGRES_PASSWORD=postgres \\",
        "      -e POSTGRES_DB=clearn_test -p 55432:5432 postgres:16",
        "    DATABASE_URL=postgres://postgres:postgres@localhost:55432/clearn_test pnpm run restore:smoke",
        "",
        "  In CI setzt .github/workflows/ci.yml die Adresse auf den Postgres-Service.",
        "  NIEMALS die Produktions-Datenbank eintragen.",
      ].join("\n")
    );
    process.exit(1);
  }

  assertThrowawayTarget(databaseUrl);

  const files = listMigrationFiles();
  if (files.length === 0) {
    throw new Error(`Keine Migrationen in ${MIGRATIONS_DIR} gefunden.`);
  }

  const scratchDb = `restore_smoke_${process.pid}_${Date.now()}`;
  const startedAt = Date.now();

  await withClient(databaseUrl, async (admin) => {
    await admin.query(`create database "${scratchDb}"`);
  });

  let checks: Check[];
  try {
    checks = await withClient(adminUrlFor(databaseUrl, scratchDb), async (client) => {
      await replayMigrations(client, files);
      return collectChecks(client, files.length);
    });
  } finally {
    await withClient(databaseUrl, async (admin) => {
      await admin.query(`drop database if exists "${scratchDb}" with (force)`);
    });
  }

  const failed = checks.filter((check) => !check.ok);

  console.log(
    JSON.stringify(
      {
        check: "restore-smoke",
        scope:
          "echter Wiederaufbau aus apps/api/supabase/migrations in eine leere Wegwerf-Datenbank; " +
          "Produktion und deren Sicherungen werden nicht angefasst",
        migrationsApplied: files.length,
        durationMs: Date.now() - startedAt,
        checks,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );

  if (failed.length > 0) {
    console.error(
      `[restore-smoke] FEHLGESCHLAGEN: ${failed.map((check) => check.name).join(" | ")}`
    );
    process.exit(1);
  }

  console.log(
    `[restore-smoke] Bestanden: ${files.length} Migrationen bauen die Datenbank aus dem Nichts wieder auf.`
  );
  console.log(
    "[restore-smoke] Nicht geprueft (nur von Hand moeglich): Ruecksicherung echter Daten bei " +
      "Supabase, Vercel-Rollback, RevenueCat-Webhooks, signierte Bild-Links. Siehe " +
      "docs/runbooks/restore-test.md."
  );
}

if (process.argv[1]?.endsWith("restore-smoke.ts")) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
