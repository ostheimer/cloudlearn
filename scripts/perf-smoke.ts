import { processScan } from "../apps/api/src/services/scanService";
import { createDeckForUser } from "../apps/api/src/services/deckService";
import { listCardsForDeck, resetStore } from "../apps/api/src/lib/inMemoryStore";
import { storeReview } from "../apps/api/src/services/reviewService";
import { resetIdempotencyStore } from "../apps/api/src/lib/idempotencyStore";

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";

function measureMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function run() {
  resetStore();
  resetIdempotencyStore();

  const deck = createDeckForUser({ userId, title: "Perf", tags: ["perf"] });

  const scanLatency = measureMs(() => {
    processScan(
      {
        userId,
        extractedText:
          "Die Photosynthese beschreibt den Prozess, bei dem Pflanzen Lichtenergie in chemische Energie umwandeln.",
        sourceLanguage: "de",
        idempotencyKey: "perf-scan-0001",
        deckId: deck.id
      },
      "req-perf-scan"
    );
  });

  const card = listCardsForDeck(userId, deck.id)[0];
  if (!card) {
    throw new Error("No card generated in perf smoke run");
  }

  const reviewLatency = measureMs(() => {
    storeReview(
      {
        userId,
        cardId: card.id,
        rating: "good",
        reviewedAt: new Date().toISOString(),
        idempotencyKey: "perf-review-0001"
      },
      "req-perf-review"
    );
  });

  console.log(
    JSON.stringify(
      {
        check: "perf-smoke",
        scanLatencyMs: Number(scanLatency.toFixed(2)),
        reviewLatencyMs: Number(reviewLatency.toFixed(2)),
        timestamp: new Date().toISOString()
      },
      null,
      2
    )
  );
}

run();
