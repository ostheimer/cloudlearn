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

  it("adds the billing_issue_at column for RevenueCat BILLING_ISSUE (#607)", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260729130000_billing_issue_at.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    expect(sql).toContain("add column if not exists billing_issue_at timestamptz");
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

  it("labels every review with the mode it came from (decoupling step 3)", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260717160000_review_logs_mode.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // Ein review_logs-Eintrag schaltet fuenf Dinge gleichzeitig (Lernplan, LP,
    // Streak, Tagesziel, Statistik). Ohne diese Spalte laesst sich keines davon
    // einzeln steuern.
    expect(sql).toContain("add column if not exists mode text not null default 'flashcard'");

    // Der Default traegt alte App-Builds (kein OTA): sie schreiben nur aus
    // Modi, die fuer alles zaehlen sollen. Ein 'legacy'-Wert waere eine
    // Fussangel — wer ihn in einer "zaehlt"-Liste vergisst, nimmt alten
    // Nutzern still die LP weg. Geprueft wird die erlaubte Werteliste, nicht
    // die ganze Datei: der Kommentar dort BEGRUENDET den Verzicht und nennt
    // das Wort dabei.
    const werte = sql.match(/add constraint review_logs_mode_check[\s\S]*?;/)?.[0] ?? "";
    expect(werte).not.toContain("legacy");

    // Benannter Constraint: spaeter erweiterbar, ohne die Spalte anzufassen.
    expect(sql).toContain("add constraint review_logs_mode_check");
    ["flashcard", "practice", "cloze", "occlusion", "quiz", "match", "test"].forEach((m) => {
      expect(sql).toContain(`'${m}'`);
    });
  });

  it("stops paying LP for test-mode reviews (decoupling step 6)", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260717170000_lp_skips_test_mode.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // Die eine Aenderung: Pruefungen zaehlen nicht mehr mit.
    expect(sql).toContain("WHERE user_id = p_user AND mode <> 'test'");

    // quiz und match zaehlen bewusst WEITER mit ("wenigstens irgendetwas").
    // Wer sie hier ausschliesst, nimmt Nutzern LP weg, die sie bekommen sollen.
    expect(sql).not.toContain("mode not in ('test', 'quiz'");
    expect(sql).not.toContain("mode = 'flashcard'");

    // Die Schutzmechanismen duerfen dabei nicht verlorengehen.
    expect(sql).toContain("FOR UPDATE");                       // Zeilensperre
    expect(sql).toContain("lp_rewarded_review_count = v_rewarded + v_consumed"); // Wasserzeichen
    expect(sql).toContain("v_remaining := greatest(p_earn_cap - v_earned, 0)");  // Tageskappe
  });

  it("pays rate-mode reviews only once per card and day (anti-farming)", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260720090000_lp_rate_modes_once_per_day.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // Quiz/Zuordnen schreiben seit Schritt 8 bei JEDER Antwort — sonst gaebe
    // es dort keine LP. Ohne Entdopplung waere Raten dreimal schneller als
    // Lernen (~1500 LP/h gegen ~500).
    expect(sql).toContain("count(DISTINCT (card_id, (reviewed_at AT TIME ZONE 'Europe/Berlin')::date))");
    expect(sql).toContain("FILTER (WHERE mode IN ('quiz', 'match'))");

    // Abruf-Modi bleiben unangetastet: wer beim Lernen mehrfach durchgeht, hat
    // mehrfach abgerufen. Eine Variante, die auch sie entdoppelt, haette
    // echten Nutzern LP genommen.
    expect(sql).toContain("count(*) FILTER (WHERE mode NOT IN ('test', 'quiz', 'match'))");

    // Berlin-Zeit wie ueberall sonst (#211) — UTC wuerde den Tag um Mitternacht
    // falsch schneiden.
    expect(sql).toContain("AT TIME ZONE 'Europe/Berlin'");

    // Schutzmechanismen erhalten.
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("v_remaining := greatest(p_earn_cap - v_earned, 0)");
  });

  it("records when a review ARRIVED, without inventing a value for old rows", () => {
    const migrationPath = join(
      apiRoot,
      "supabase/migrations/20260720100000_review_logs_inserted_at.sql",
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // Zwei Schritte sind der ganze Punkt: erst die Spalte OHNE Default (alte
    // Zeilen bleiben NULL = "unbekannt"), dann den Default fuer neue Zeilen.
    // In einem Rutsch wuerde PG den Wert einmal auswerten und ALLEN Altzeilen
    // zuweisen — sie behaupteten dann, zum Migrationszeitpunkt eingetroffen zu
    // sein. Genau diese erfundene Zahl waere spaeter die Messgrundlage.
    expect(sql).toContain("add column if not exists inserted_at timestamptz;");
    expect(sql).toContain("alter column inserted_at set default now()");
    expect(sql).not.toContain("add column if not exists inserted_at timestamptz not null");
    expect(sql).not.toMatch(/add column[^;]*inserted_at[^;]*default now\(\)/);
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

  it("revokes execute from anon AND authenticated wherever it creates a SECURITY DEFINER function", () => {
    // `revoke ... from public` looks like it locks a function down. It does not:
    // Supabase grants EXECUTE on functions in the `public` schema explicitly to
    // the `anon` and `authenticated` roles, and revoking from the PUBLIC
    // pseudo-role leaves those grants untouched. The function stays callable at
    // /rest/v1/rpc/<name> with the anon key that ships inside the web bundle.
    //
    // This is not hypothetical. delete_account_data (SECURITY DEFINER, target
    // user id as a *parameter*) went live that way on 20.07. and was, for about
    // 40 minutes, an endpoint for deleting anybody's account and every deck,
    // card and point attached to it. Nothing was exploited — but nothing in the
    // code said anything was wrong either. Only the Supabase linter noticed.
    //
    // So: any migration that defines such a function must name both roles.
    const migrationDir = join(apiRoot, "supabase/migrations");
    const offenders = readdirSync(migrationDir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => ({
        file,
        // Comments explain the trap and mention the roles; only real SQL counts.
        sql: readFileSync(join(migrationDir, file), "utf-8")
          .replace(/--[^\n]*/g, "")
          .toLowerCase(),
      }))
      .filter(({ sql }) => /security\s+definer/.test(sql))
      .filter(
        ({ sql }) =>
          !/revoke\s+[^;]*\bfrom\s+[^;]*\banon\b/.test(sql) ||
          !/revoke\s+[^;]*\bfrom\s+[^;]*\bauthenticated\b/.test(sql),
      )
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it("leaves clients no write verb on profiles — not UPDATE, not INSERT, not DELETE", () => {
    // profiles holds lp_balance and subscription_tier: the two columns that
    // decide how many points somebody has and whether they get Pro. The RLS
    // policy `users_own_profile` is `for all using (auth.uid() = id)` with no
    // WITH CHECK — it only asks WHOSE row this is, never WHAT is in it. The
    // grants are therefore the whole defence.
    //
    // 20260404140000 revoked UPDATE and re-granted five cosmetic columns,
    // reasoning that "the client never writes profiles directly". True — but it
    // left INSERT and DELETE granted, and those two together are the same
    // escalation through another door: delete your own row, insert a fresh one
    // with lp_balance 999999 and subscription_tier 'lifetime'. Closed on
    // 21.07. by 20260721100000; verified against prod before and after (23505
    // "duplicate key" before, 42501 "permission denied" after).
    //
    // Reading the migrations in apply order and demanding a REVOKE as the last
    // word per verb keeps a later migration from quietly handing one back —
    // Supabase's own `GRANT ALL ON ALL TABLES` in a future setup script would
    // do exactly that.
    const migrationDir = join(apiRoot, "supabase/migrations");
    const statements = readdirSync(migrationDir)
      .filter((file) => file.endsWith(".sql"))
      .sort() // filenames are timestamps → lexical order is apply order
      .flatMap((file) =>
        (readFileSync(join(migrationDir, file), "utf-8")
          .replace(/--[^\n]*/g, "") // comments quote the verbs; only real SQL counts
          .match(/(?:grant|revoke)[^;]*\bprofiles\b[^;]*;/gi) ?? []
        ).map((statement) => ({ file, sql: statement.toLowerCase() })),
      );

    // Column-scoped grants like `grant update (display_name, …)` are the
    // deliberate exception: they hand back only cosmetic columns.
    const isColumnScoped = (sql: string) => /\b(update|insert)\s*\(/.test(sql);

    for (const verb of ["update", "insert", "delete"] as const) {
      const touching = statements.filter(
        ({ sql }) =>
          new RegExp(`\\b${verb}\\b`).test(sql) &&
          /\b(anon|authenticated)\b/.test(sql) &&
          !isColumnScoped(sql),
      );

      expect(
        touching.length,
        `no migration revokes blanket ${verb.toUpperCase()} on profiles from clients`,
      ).toBeGreaterThan(0);

      expect(
        touching.at(-1)?.sql.startsWith("revoke"),
        `the last word on ${verb.toUpperCase()} for profiles is a GRANT (in ${touching.at(-1)?.file}) — ` +
          "clients would be able to write lp_balance / subscription_tier again",
      ).toBe(true);
    }
  });

  it("test_attempts: eigene Tabelle, RLS ohne Policy, Rechte entzogen, Funktion abgesichert", () => {
    const sql = readFileSync(
      join(apiRoot, "supabase/migrations/20260723071835_test_attempts.sql"),
      "utf-8"
    );
    // Kommentare zitieren dieselben Verben; nur echtes SQL, Whitespace geglättet.
    const flat = sql.replace(/--[^\n]*/g, "").replace(/\s+/g, " ");

    // Tabelle + beide Fremdschlüssel als Kaskade → verhindert, dass die
    // Konto-Löschung Prüfungen zurücklässt.
    expect(flat).toContain("create table if not exists test_attempts");
    expect(flat).toContain("user_id uuid not null references profiles(id) on delete cascade");
    expect(flat).toContain("deck_id uuid not null references decks(id) on delete cascade");
    // Tippfehlerschutz → „35 von 30" ist nicht speicherbar.
    expect(flat).toContain("question_count between 1 and 5000");
    expect(flat).toContain("correct_count between 0 and question_count");

    // RLS an, aber KEINE Policy: die fehlende Policy IST das Sicherheitsmerkmal.
    // Eine Policy hier würde jeder Nutzerin „30 von 30" und das Löschen
    // missratener Prüfungen erlauben — ein späteres Hinzufügen soll rot werden.
    expect(flat).toContain("alter table test_attempts enable row level security");
    expect(flat).not.toMatch(/create policy/i);
    expect(flat).toContain("revoke all on table public.test_attempts from anon, authenticated");

    // Doppel-Abgabe (Zeit-Modus) trifft eine Zeile, nicht zwei.
    expect(flat).toContain(
      "create unique index if not exists test_attempts_idempotency_key_idx on test_attempts (user_id, idempotency_key)"
    );

    // Funktion: greatest() macht die Korrektur monoton (ältere 18 überschreibt
    // keine gespeicherte 19), WHERE deck_id verhindert das Umschreiben einer
    // fremden Prüfung auf ein anderes Deck.
    expect(flat).toContain("greatest(test_attempts.question_count, excluded.question_count)");
    expect(flat).toContain("greatest(test_attempts.correct_count, excluded.correct_count)");
    expect(flat).toContain("where test_attempts.deck_id = excluded.deck_id");
    // revoke gegen public allein sperrt anon/authenticated NICHT aus (die
    // delete_account_data-Lücke) → beide werden ausdrücklich entzogen.
    expect(flat).toContain(
      "revoke execute on function record_test_attempt(uuid, uuid, text, int, int) from anon"
    );
    expect(flat).toContain(
      "revoke execute on function record_test_attempt(uuid, uuid, text, int, int) from authenticated"
    );
    expect(flat).toContain(
      "grant execute on function record_test_attempt(uuid, uuid, text, int, int) to service_role"
    );
  });

  it("test_attempts: die Härtung verankert den Suchpfad fest", () => {
    const sql = readFileSync(
      join(apiRoot, "supabase/migrations/20260723072036_test_attempts_harden_search_path.sql"),
      "utf-8"
    );
    // Ohne festen search_path wäre die Funktion „role mutable" (Advisor-WARN)
    // und potentiell über einen manipulierten Pfad angreifbar.
    expect(sql.replace(/\s+/g, " ")).toContain("set search_path = ''");
  });

  it("jede create-table-Migration ab 20260722 aktiviert RLS in derselben Datei", () => {
    // Die Fehlerklasse „neue Tabelle offen, bis jemand zusperrt" hat viermal
    // zugeschlagen. Für neue Migrationen ist RLS in derselben Datei Pflicht.
    // Bewusst erst ab 20260722: ältere Tabellen bekamen RLS teils erst Monate
    // später (z. B. deleted_accounts) — die rückwirkend zu prüfen, würde den
    // Test ohne Sicherheitsgewinn rot machen.
    const migrationDir = join(apiRoot, "supabase/migrations");
    const files = readdirSync(migrationDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files) {
      if (file < "20260722") continue;
      const sql = readFileSync(join(migrationDir, file), "utf-8")
        .replace(/--[^\n]*/g, "")
        .toLowerCase();
      const tables = [
        ...sql.matchAll(/create table(?:\s+if not exists)?\s+(?:public\.)?([a-z_][a-z0-9_]*)/g),
      ].map((match) => match[1]);
      for (const table of tables) {
        expect(
          new RegExp(`alter table\\s+(?:public\\.)?${table}\\s+enable row level security`).test(sql),
          `${table} (in ${file}) braucht "enable row level security" in derselben Datei`
        ).toBe(true);
      }
    }
  });
});
