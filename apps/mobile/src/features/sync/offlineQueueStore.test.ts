import { beforeEach, describe, expect, it, vi } from "vitest";

// Die Warteschlange spricht mit AsyncStorage und mit der API. Beides wird hier
// ersetzt: geprüft wird ausschließlich, WAS die Warteschlange mit einer Antwort
// des Servers macht.
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

const syncReviewOperations = vi.fn();

vi.mock("../../lib/api", () => ({
  syncReviewOperations: (...args: unknown[]) => syncReviewOperations(...args),
}));

const {
  createReviewSyncOperation,
  syncPendingReviewOperations,
  useOfflineQueueStore,
} = await import("./offlineQueueStore");

const STORAGE_KEY = "clearn-offline-review-queue-v1";
const USER_ID = "user-1";

function operation(key: string) {
  return createReviewSyncOperation({
    userId: USER_ID,
    cardId: `card-${key}`,
    rating: "good",
    idempotencyKey: key,
    reviewedAt: "2026-07-20T10:00:00.000Z",
  });
}

function serverAnswer(input: {
  accepted?: string[];
  rejected?: string[];
  failed?: string[];
}) {
  return {
    requestId: "req-sync-test",
    acceptedOperationIds: input.accepted ?? [],
    rejectedOperationIds: input.rejected ?? [],
    // Neues drittes Feld des Servers. Der Client liest es bewusst nicht — er
    // behält einfach alles, was weder angenommen noch abgelehnt wurde.
    failedOperationIds: input.failed ?? [],
    serverTimestamp: "2026-07-20T10:00:05.000Z",
  };
}

function queue() {
  return useOfflineQueueStore.getState().queue;
}

function ids(operations: { operationId: string }[]) {
  return operations.map((item) => item.operationId);
}

function resetQueue(hydrated: boolean) {
  storage.clear();
  useOfflineQueueStore.setState({
    queue: {
      pending: [],
      inFlight: [],
      hydrated,
      syncing: false,
      lastSyncedAt: null,
      rejectedCount: 0,
    },
  });
}

describe("Offline-Warteschlange — was beim Hochladen mit einer Antwort passiert (#418)", () => {
  beforeEach(() => {
    syncReviewOperations.mockReset();
    resetQueue(true);
  });

  it("entfernt angenommene Wiederholungen aus der Warteschlange", async () => {
    useOfflineQueueStore.getState().enqueue(operation("review-a"));
    syncReviewOperations.mockResolvedValue(serverAnswer({ accepted: ["review-a"] }));

    const result = await syncPendingReviewOperations(USER_ID);

    expect(result).toEqual({ synced: 1, rejected: 0, retrying: 0 });
    expect(ids(queue().pending)).toEqual([]);
    expect(ids(queue().inFlight)).toEqual([]);
  });

  it("entfernt endgültig abgelehnte Wiederholungen — merkt sie sich aber sichtbar", async () => {
    useOfflineQueueStore.getState().enqueue(operation("review-b"));
    syncReviewOperations.mockResolvedValue(serverAnswer({ rejected: ["review-b"] }));

    const result = await syncPendingReviewOperations(USER_ID);

    expect(result).toEqual({ synced: 0, rejected: 1, retrying: 0 });
    expect(ids(queue().pending)).toEqual([]);
    expect(ids(queue().inFlight)).toEqual([]);
    // Ohne diesen Zähler verschwände die Antwort still — genau das Stille war
    // die Beschwerde in #418.
    expect(queue().rejectedCount).toBe(1);
  });

  it("BEHÄLT vorübergehend Gescheitertes in pending — und lässt es nicht in inFlight hängen", async () => {
    useOfflineQueueStore.getState().enqueue(operation("review-ok"));
    useOfflineQueueStore.getState().enqueue(operation("review-blip"));
    syncReviewOperations.mockResolvedValue(
      serverAnswer({ accepted: ["review-ok"], failed: ["review-blip"] })
    );

    const result = await syncPendingReviewOperations(USER_ID);

    expect(result).toEqual({ synced: 1, rejected: 0, retrying: 1 });
    // Der Kern: Die offline gelernte Antwort ist noch da.
    expect(ids(queue().pending)).toEqual(["review-blip"]);
    // Und sie steckt nicht im Zwischenzustand fest — verschickt wird nur pending.
    expect(ids(queue().inFlight)).toEqual([]);
    expect(queue().rejectedCount).toBe(0);
  });

  it("holt das vorübergehend Gescheiterte beim zweiten Anlauf nach", async () => {
    useOfflineQueueStore.getState().enqueue(operation("review-blip"));
    syncReviewOperations.mockResolvedValueOnce(
      serverAnswer({ accepted: [], failed: ["review-blip"] })
    );
    await syncPendingReviewOperations(USER_ID);
    expect(ids(queue().pending)).toEqual(["review-blip"]);

    syncReviewOperations.mockResolvedValueOnce(
      serverAnswer({ accepted: ["review-blip"] })
    );
    const second = await syncPendingReviewOperations(USER_ID);

    expect(second).toEqual({ synced: 1, rejected: 0, retrying: 0 });
    expect(ids(queue().pending)).toEqual([]);
    expect(ids(queue().inFlight)).toEqual([]);
    // Zweiter Anlauf, aber derselbe Schlüssel: Der Server erkennt die
    // Wiederholung an findReviewByIdempotencyKey wieder (und die Datenbank hat
    // zusätzlich einen eindeutigen Index darauf) — nichts wird doppelt gebucht.
    const secondCall = syncReviewOperations.mock.calls[1] as [
      string,
      { payload: { idempotencyKey: string } }[],
    ];
    expect(secondCall[1][0]?.payload.idempotencyKey).toBe("review-blip");
  });

  it("verliert nichts gegen einen ÄLTEREN Server ohne failedOperationIds", async () => {
    useOfflineQueueStore.getState().enqueue(operation("review-old"));
    syncReviewOperations.mockResolvedValue({
      requestId: "req-sync-old",
      acceptedOperationIds: [],
      rejectedOperationIds: [],
      serverTimestamp: "2026-07-20T10:00:05.000Z",
    });

    const result = await syncPendingReviewOperations(USER_ID);

    expect(result).toEqual({ synced: 0, rejected: 0, retrying: 1 });
    expect(ids(queue().pending)).toEqual(["review-old"]);
    expect(ids(queue().inFlight)).toEqual([]);
  });

  it("legt bei einem abgebrochenen Aufruf (z. B. 503) alles zurück in pending", async () => {
    useOfflineQueueStore.getState().enqueue(operation("review-503"));
    syncReviewOperations.mockRejectedValue(new Error("Sync temporarily unavailable"));

    await expect(syncPendingReviewOperations(USER_ID)).rejects.toThrow();

    expect(ids(queue().pending)).toEqual(["review-503"]);
    expect(ids(queue().inFlight)).toEqual([]);
  });

  it("befreit beim Laden, was ein früherer Anlauf in inFlight hat hängen lassen", async () => {
    resetQueue(false);
    storage.set(
      STORAGE_KEY,
      JSON.stringify({
        pending: [operation("review-pending")],
        inFlight: [operation("review-stranded")],
        lastSyncedAt: null,
      })
    );

    await useOfflineQueueStore.getState().initialize();

    expect(ids(queue().inFlight)).toEqual([]);
    expect(ids(queue().pending).sort()).toEqual(["review-pending", "review-stranded"]);
  });
});
