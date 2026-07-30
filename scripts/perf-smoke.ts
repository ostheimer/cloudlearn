/**
 * Perf-Proben für clearn — zwei klar getrennte Modi (#86).
 *
 *   pnpm run perf:smoke   In-Process-Schnellprüfung (Standard).
 *                         Misst Programmteile im Arbeitsspeicher, ohne Netz und
 *                         ohne echte Datenbank. Nützlich als Plausibilitätscheck,
 *                         aber KEIN Beweis, dass die veröffentlichte App schnell
 *                         ist — das war der Attrappen-Vorwurf aus #86.
 *
 *   pnpm run perf:http    ECHTE Messung: schickt richtige HTTP-Anfragen an das
 *                         Deployment, mehrfach, und vergleicht das 95er-Perzentil
 *                         mit den Budgets aus docs/runbooks/performance-budgets.md.
 *
 * Der HTTP-Modus fragt ausschliesslich LESEND ab: er legt nichts an, ändert
 * nichts und löst keine KI-Aufrufe aus. Damit kostet ein Lauf kein Geld und
 * verändert keine Daten in der Produktions-Datenbank.
 */

import { generateWithModelFallback } from "../apps/api/src/lib/llm";
import {
  createCard,
  createDeck,
  createReview,
  listCardsForDeck,
  resetStore,
  updateCardFsrs,
} from "../apps/api/src/lib/inMemoryStore";
import { resetIdempotencyStore } from "../apps/api/src/lib/idempotencyStore";

// In-process sanity bounds (in-memory store, single call) — deliberately generous.
// These are NOT the real deployed P95 budgets in docs/runbooks/performance-budgets.md,
// which must be measured against the actual HTTP deployment.
const IN_PROCESS_BUDGET_MS = { scan: 2000, review: 200 };

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const extractedText =
  "Die Photosynthese beschreibt den Prozess, bei dem Pflanzen Lichtenergie in chemische Energie umwandeln.";

async function measureMs(fn: () => void | Promise<void>): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

export async function run() {
  resetStore();
  resetIdempotencyStore();

  const deck = createDeck(userId, "Perf", ["perf"]);

  const scanLatency = await measureMs(() => {
    const generated = generateWithModelFallback(extractedText, "de");
    for (const card of generated.cards) {
      createCard(userId, deck.id, card);
    }
  });

  const card = listCardsForDeck(userId, deck.id)[0];
  if (!card) {
    throw new Error("No card generated in perf smoke run");
  }

  const reviewLatency = await measureMs(() => {
    const reviewedAt = new Date();
    createReview({
      userId,
      cardId: card.id,
      rating: "good",
      reviewedAt: reviewedAt.toISOString(),
      idempotencyKey: "perf-review-0001"
    });
    updateCardFsrs(card.id, {
      fsrsDue: new Date(reviewedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      fsrsStability: 1,
      fsrsDifficulty: 1,
      fsrsState: "learning"
    });
  });

  console.log(
    JSON.stringify(
      {
        check: "perf-smoke",
        scope:
          "in-process (in-memory store) only — does NOT measure the deployed HTTP endpoint or real P95 budgets (see docs/runbooks/performance-budgets.md)",
        scanLatencyMs: Number(scanLatency.toFixed(2)),
        reviewLatencyMs: Number(reviewLatency.toFixed(2)),
        timestamp: new Date().toISOString()
      },
      null,
      2
    )
  );

  if (scanLatency > IN_PROCESS_BUDGET_MS.scan) {
    console.error(
      `[perf-smoke] in-process scan latency ${scanLatency.toFixed(2)}ms exceeded in-process budget of ${IN_PROCESS_BUDGET_MS.scan}ms`
    );
    process.exit(1);
  }

  if (reviewLatency > IN_PROCESS_BUDGET_MS.review) {
    console.error(
      `[perf-smoke] in-process review latency ${reviewLatency.toFixed(2)}ms exceeded in-process budget of ${IN_PROCESS_BUDGET_MS.review}ms`
    );
    process.exit(1);
  }

  console.log("[perf-smoke] in-process sanity check passed (NOT a real perf gate).");
  console.log(
    "[perf-smoke] Fuer eine echte Messung gegen das Deployment: pnpm run perf:http"
  );
}

// ───────────────────────────── HTTP-Modus (echt) ─────────────────────────────

type HttpEndpoint = {
  /** Was der Mensch davon merkt — steht so auch in der Ausgabe. */
  label: string;
  path: string;
  auth: boolean;
  /**
   * Budget für das 95er-Perzentil in Millisekunden. Kalibriert am 2026-07-30
   * gegen clearn-api.vercel.app und mit reichlich Luft versehen: die Probe soll
   * echte Verschlechterungen finden, nicht bei jedem Netz-Zucken rot werden.
   */
  budgetMs: number;
};

const HTTP_ENDPOINTS: HttpEndpoint[] = [
  { label: "Lebenszeichen der API", path: "/api/health", auth: false, budgetMs: 1500 },
  { label: "Bibliothek laden", path: "/api/v1/decks", auth: true, budgetMs: 2500 },
  { label: "Lernen starten (faellige Karten)", path: "/api/v1/learn/due", auth: true, budgetMs: 2500 },
  { label: "Faellig-Zahlen je Kartenkasten", path: "/api/v1/stats/due-by-deck", auth: true, budgetMs: 2500 },
];

/** Aus docs/runbooks/performance-budgets.md: Fehlerquote 5xx < 1 %. */
const MAX_ERROR_RATE = 0.01;

export type HttpOptions = {
  baseUrl: string;
  samples: number;
  warmup: number;
  publicOnly: boolean;
};

/** Kleinste Stichprobe, bei der ein 95er-Perzentil überhaupt etwas aussagt. */
const MIN_SAMPLES = 5;

export function parseHttpArgs(argv: string[]): HttpOptions {
  const value = (flag: string): string | undefined =>
    argv.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);

  const samples = Number(value("--samples") ?? 20);
  const warmup = Number(value("--warmup") ?? 2);

  if (!Number.isInteger(samples) || samples < MIN_SAMPLES) {
    throw new Error(
      `--samples muss eine ganze Zahl ab ${MIN_SAMPLES} sein (bekommen: ${String(samples)}). ` +
        `Bei weniger Messungen ist ein 95er-Perzentil nur geraten.`
    );
  }
  if (!Number.isInteger(warmup) || warmup < 0) {
    throw new Error(`--warmup muss eine ganze Zahl ab 0 sein (bekommen: ${String(warmup)}).`);
  }

  return {
    baseUrl: (
      value("--base-url") ??
      process.env.E2E_API_BASE_URL ??
      "https://clearn-api.vercel.app"
    ).replace(/\/$/, ""),
    samples,
    warmup,
    publicOnly: argv.includes("--public-only"),
  };
}

/** Nearest-Rank-Perzentil: der Wert, unter dem p Prozent der Messungen liegen. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1] ?? Number.NaN;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Umgebungsvariable "${name}" fehlt. Der HTTP-Modus meldet sich mit dem Test-Konto an und ` +
        `liest alle Zugangsdaten aus der Umgebung (lokal .env, in CI die Secrets) — niemals aus dem Code. ` +
        `Ohne Anmeldung nur die oeffentliche Messung: pnpm run perf:http --public-only`
    );
  }
  return value;
}

/** Holt einen Zugangs-Token für das Test-Konto (gleicher Weg wie e2e/helpers.ts). */
async function fetchAccessToken(): Promise<string> {
  const supabaseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: requireEnv("TEST_USER_EMAIL"),
      password: requireEnv("TEST_USER_PASSWORD"),
    }),
  });
  const data = (await response.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(
      `Anmeldung des Test-Kontos fehlgeschlagen (HTTP ${response.status}). ` +
        `Grund laut Supabase: ${data.error_description ?? "unbekannt"}`
    );
  }
  return data.access_token;
}

type EndpointResult = {
  label: string;
  path: string;
  p50Ms: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  budgetMs: number;
  errorRate: number;
  statuses: number[];
  ok: boolean;
};

async function measureEndpoint(
  baseUrl: string,
  endpoint: HttpEndpoint,
  token: string | null,
  options: HttpOptions
): Promise<EndpointResult> {
  const latencies: number[] = [];
  const statuses = new Set<number>();
  let errors = 0;

  const headers: Record<string, string> = { accept: "application/json" };
  if (endpoint.auth && token) headers.authorization = `Bearer ${token}`;

  for (let attempt = 0; attempt < options.warmup + options.samples; attempt += 1) {
    // Die ersten Anfragen wärmen den Server auf (Vercel startet Funktionen bei
    // Bedarf neu). Sie werden bewusst verworfen, sonst misst man einmal Kaltstart
    // statt Alltag — und das würde die Probe unbrauchbar zappelig machen.
    const counted = attempt >= options.warmup;
    const start = performance.now();
    try {
      const response = await fetch(`${baseUrl}${endpoint.path}`, { headers });
      // Antwort komplett lesen, sonst misst man nur die Kopfzeilen.
      await response.arrayBuffer();
      if (counted) {
        latencies.push(performance.now() - start);
        statuses.add(response.status);
        if (!response.ok) errors += 1;
      }
    } catch {
      if (counted) {
        errors += 1;
        statuses.add(0);
      }
    }
  }

  const p95 = percentile(latencies, 95);
  const errorRate = errors / options.samples;
  const round = (value: number) => (Number.isNaN(value) ? value : Number(value.toFixed(1)));

  return {
    label: endpoint.label,
    path: endpoint.path,
    p50Ms: round(percentile(latencies, 50)),
    p95Ms: round(p95),
    minMs: round(latencies.length > 0 ? Math.min(...latencies) : Number.NaN),
    maxMs: round(latencies.length > 0 ? Math.max(...latencies) : Number.NaN),
    budgetMs: endpoint.budgetMs,
    errorRate: Number(errorRate.toFixed(4)),
    statuses: [...statuses].sort((a, b) => a - b),
    ok: !Number.isNaN(p95) && p95 <= endpoint.budgetMs && errorRate <= MAX_ERROR_RATE,
  };
}

export async function runHttp(options: HttpOptions): Promise<EndpointResult[]> {
  const endpoints = options.publicOnly
    ? HTTP_ENDPOINTS.filter((endpoint) => !endpoint.auth)
    : HTTP_ENDPOINTS;
  const token = endpoints.some((endpoint) => endpoint.auth) ? await fetchAccessToken() : null;

  const results: EndpointResult[] = [];
  for (const endpoint of endpoints) {
    results.push(await measureEndpoint(options.baseUrl, endpoint, token, options));
  }
  return results;
}

async function runHttpCli(argv: string[]): Promise<void> {
  const options = parseHttpArgs(argv);
  const results = await runHttp(options);

  console.log(
    JSON.stringify(
      {
        check: "perf-http",
        scope:
          "echte HTTP-Messung gegen das Deployment, ausschliesslich lesende Abfragen — " +
          "keine Schreibvorgaenge, keine KI-Aufrufe, keine Kosten",
        baseUrl: options.baseUrl,
        samplesPerEndpoint: options.samples,
        warmupDiscarded: options.warmup,
        maxErrorRate: MAX_ERROR_RATE,
        results,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    for (const result of failed) {
      console.error(
        `[perf-http] "${result.label}" (${result.path}): P95 ${result.p95Ms}ms gegen Budget ` +
          `${result.budgetMs}ms, Fehlerquote ${(result.errorRate * 100).toFixed(1)}% ` +
          `(erlaubt ${(MAX_ERROR_RATE * 100).toFixed(0)}%), HTTP-Status ${result.statuses.join("/")}`
      );
    }
    process.exit(1);
  }

  console.log(
    `[perf-http] Bestanden: ${results.length} Abfragen gegen ${options.baseUrl} innerhalb der Budgets.`
  );
  console.log(
    "[perf-http] Nicht gemessen: Scan-Verarbeitung (kostet KI-Guthaben) und Karte-bewerten " +
      "(schreibt in die Produktions-Datenbank). Siehe docs/runbooks/performance-budgets.md."
  );
}

if (process.argv[1]?.endsWith("perf-smoke.ts")) {
  const argv = process.argv.slice(2);
  const started = argv.includes("--http") ? runHttpCli(argv) : run();
  started.catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
