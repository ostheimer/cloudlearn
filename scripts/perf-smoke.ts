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
}

if (process.argv[1]?.endsWith("perf-smoke.ts")) {
  run().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
