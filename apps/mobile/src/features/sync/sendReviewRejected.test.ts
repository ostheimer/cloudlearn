import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #605: Wird eine Karte auf Gerät A gelöscht, während Gerät B sie noch lernt,
 * lehnt der Server die Bewertung mit 404 ab. Der Helfer reihte sie zu Recht
 * nicht wieder ein (ein zweiter Versuch würde genauso abgelehnt) — warf sie
 * aber STILL weg: `rejectedCount` blieb 0 und das Hinweis-Banner des
 * Lern-Tabs feuerte nie. Hier wird das VERHALTEN geprüft, nicht der
 * Quelltext: Was passiert mit welcher Server-Antwort?
 */

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

/** Nachbau des echten ApiError aus lib/api — nur status/code zählen hier. */
class FakeApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    if (code) this.code = code;
  }
}

const reviewCard = vi.fn();

vi.mock("../../lib/api", () => ({
  reviewCard: (...args: unknown[]) => reviewCard(...args),
  isApiError: (error: unknown) => error instanceof FakeApiError,
  syncReviewOperations: vi.fn(),
}));

const { sendReview } = await import("./sendReview");
const { useOfflineQueueStore } = await import("./offlineQueueStore");

function queue() {
  return useOfflineQueueStore.getState().queue;
}

function send() {
  return sendReview({
    userId: "user-1",
    cardId: "card-1",
    rating: "good",
    mode: "quiz",
  });
}

describe("sendReview — endgültige Ablehnungen zählen statt verschwinden (#605)", () => {
  beforeEach(() => {
    reviewCard.mockReset();
    storage.clear();
    useOfflineQueueStore.setState({
      queue: {
        pending: [],
        inFlight: [],
        hydrated: true,
        syncing: false,
        lastSyncedAt: null,
        rejectedCount: 0,
      },
    });
  });

  it("404 (Karte inzwischen gelöscht): nicht einreihen, aber zählen", async () => {
    reviewCard.mockRejectedValue(new FakeApiError("Card not found", 404, "CARD_NOT_FOUND"));

    await send();

    // Nicht in der Warteschlange: Ein zweiter Versuch würde genauso abgelehnt.
    expect(queue().pending).toHaveLength(0);
    // Aber sichtbar gezählt — davon lebt das Hinweis-Banner im Lern-Tab.
    expect(queue().rejectedCount).toBe(1);
  });

  it("Serverfehler (500): einreihen für später, kein Ablehnungs-Hinweis", async () => {
    reviewCard.mockRejectedValue(new FakeApiError("Server down", 500));

    await send();

    expect(queue().pending).toHaveLength(1);
    expect(queue().rejectedCount).toBe(0);
  });

  it("429 (eigene Bremse): einreihen, kein Ablehnungs-Hinweis", async () => {
    reviewCard.mockRejectedValue(new FakeApiError("Too many requests", 429));

    await send();

    expect(queue().pending).toHaveLength(1);
    expect(queue().rejectedCount).toBe(0);
  });

  it("Netzfehler (kein ApiError): einreihen, kein Ablehnungs-Hinweis", async () => {
    reviewCard.mockRejectedValue(new Error("Failed to fetch"));

    await send();

    expect(queue().pending).toHaveLength(1);
    expect(queue().rejectedCount).toBe(0);
  });

  it("Erfolg: weder Warteschlange noch Zähler", async () => {
    reviewCard.mockResolvedValue({});

    await send();

    expect(queue().pending).toHaveLength(0);
    expect(queue().rejectedCount).toBe(0);
  });
});
