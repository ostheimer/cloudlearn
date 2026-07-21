import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import {
  syncReviewOperations,
  type ReviewMode,
  type ReviewSyncOperation,
} from "../../lib/api";

const OFFLINE_QUEUE_STORAGE_KEY = "clearn-offline-review-queue-v1";

interface QueueState {
  pending: ReviewSyncOperation[];
  inFlight: ReviewSyncOperation[];
  hydrated: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  /**
   * Wie viele Wiederholungen der Server ENDGÜLTIG abgelehnt hat, seit die
   * Nutzerin es zuletzt zur Kenntnis genommen hat. Die zählt niemand mehr —
   * darum darf das nicht still passieren (#418). Der Lern-Bildschirm zeigt
   * dafür sein vorhandenes Hinweis-Banner; Antippen quittiert (acknowledgeRejected).
   */
  rejectedCount: number;
}

interface PersistedQueueState {
  pending: ReviewSyncOperation[];
  inFlight: ReviewSyncOperation[];
  lastSyncedAt: string | null;
  rejectedCount?: number;
}

const initialQueueState: QueueState = {
  pending: [],
  inFlight: [],
  hydrated: false,
  syncing: false,
  lastSyncedAt: null,
  rejectedCount: 0,
};

function toPersistedQueue(queue: QueueState): PersistedQueueState {
  return {
    pending: queue.pending,
    inFlight: queue.inFlight,
    lastSyncedAt: queue.lastSyncedAt,
    // Mitgesichert, damit der Hinweis einen App-Neustart überlebt: Der
    // Hintergrund-Abgleich läuft beim Start, der Lern-Bildschirm wird
    // vielleicht erst viel später geöffnet.
    rejectedCount: queue.rejectedCount,
  };
}

async function persistQueue(queue: QueueState): Promise<void> {
  try {
    await AsyncStorage.setItem(
      OFFLINE_QUEUE_STORAGE_KEY,
      JSON.stringify(toPersistedQueue(queue))
    );
  } catch {
    // Offline queue persistence is best-effort.
  }
}

function hasOperation(
  operations: ReviewSyncOperation[],
  candidate: ReviewSyncOperation
): boolean {
  return operations.some(
    (operation) =>
      operation.operationId === candidate.operationId ||
      operation.payload.idempotencyKey === candidate.payload.idempotencyKey
  );
}

function enqueueOperation(
  state: QueueState,
  operation: ReviewSyncOperation
): QueueState {
  if (
    hasOperation(state.pending, operation) ||
    hasOperation(state.inFlight, operation)
  ) {
    return state;
  }

  return {
    ...state,
    pending: [...state.pending, operation],
  };
}

function markOperationsInFlight(
  state: QueueState,
  operationIds: string[]
): QueueState {
  if (operationIds.length === 0) {
    return state;
  }

  const selected = new Set(operationIds);
  const moving = state.pending.filter((operation) =>
    selected.has(operation.operationId)
  );

  if (moving.length === 0) {
    return state;
  }

  return {
    ...state,
    pending: state.pending.filter(
      (operation) => !selected.has(operation.operationId)
    ),
    inFlight: [...state.inFlight, ...moving],
  };
}

/**
 * Abschluss einer Sendung.
 *
 * FERTIG ist nur zweierlei: angenommen (gespeichert) und endgültig abgelehnt
 * (wird nie gutgehen). Alles andere — vorübergehend gescheitert oder vom Server
 * gar nicht erwähnt — ist unerledigte Arbeit und gehört zurück in `pending`.
 *
 * Vorher galt „abgelehnt" wie „angenommen" und alles Unerwähnte blieb für immer
 * in `inFlight` hängen (verschickt wird ausschließlich `pending`). Beides hat
 * offline gelernte Antworten still verschluckt — das war #418.
 */
function finalizeOperations(
  state: QueueState,
  acceptedOperationIds: string[],
  rejectedOperationIds: string[],
  serverTimestamp: string
): QueueState {
  const finished = new Set([
    ...acceptedOperationIds,
    ...rejectedOperationIds,
  ]);

  const settled: QueueState = {
    ...state,
    pending: state.pending.filter(
      (operation) => !finished.has(operation.operationId)
    ),
    inFlight: state.inFlight.filter(
      (operation) => !finished.has(operation.operationId)
    ),
    lastSyncedAt: serverTimestamp,
    rejectedCount: state.rejectedCount + rejectedOperationIds.length,
  };

  // Was JETZT noch in inFlight liegt, ist nicht mehr unterwegs — die Antwort
  // des Servers ist ja da. Ohne diesen Schritt bliebe es dort liegen, ohne je
  // wieder verschickt zu werden.
  return requeueInFlight(settled);
}

function requeueInFlight(
  state: QueueState,
  operationIds?: string[]
): QueueState {
  if (state.inFlight.length === 0) {
    return state;
  }

  const selected = operationIds ? new Set(operationIds) : null;
  const returning = state.inFlight.filter(
    (operation) => !selected || selected.has(operation.operationId)
  );
  const remaining = state.inFlight.filter(
    (operation) => selected && !selected.has(operation.operationId)
  );

  if (returning.length === 0) {
    return state;
  }

  const pending = [...returning];
  for (const operation of state.pending) {
    if (!hasOperation(pending, operation)) {
      pending.push(operation);
    }
  }

  return {
    ...state,
    pending,
    inFlight: remaining,
  };
}

function applyQueueUpdate(
  set: (
    partial:
      | Partial<OfflineQueueState>
      | ((state: OfflineQueueState) => Partial<OfflineQueueState>)
  ) => void,
  update: (queue: QueueState) => QueueState
) {
  set((state) => {
    const queue = update(state.queue);
    void persistQueue(queue);
    return { queue };
  });
}

export function createReviewSyncOperation(input: {
  userId: string;
  cardId: string;
  rating: "again" | "hard" | "good" | "easy";
  reviewedAt?: string;
  reviewDurationMs?: number;
  idempotencyKey?: string;
  /**
   * Lernmodus dieser Wiederholung. Optional: Wer nichts angibt, verhält sich
   * exakt wie vorher — der Server trägt dann "flashcard" ein.
   */
  mode?: ReviewMode;
}): ReviewSyncOperation {
  const reviewedAt = input.reviewedAt ?? new Date().toISOString();
  const idempotencyKey =
    input.idempotencyKey ??
    `review-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const payload: ReviewSyncOperation["payload"] = {
    userId: input.userId,
    cardId: input.cardId,
    rating: input.rating,
    reviewedAt,
    idempotencyKey,
  };

  if (input.reviewDurationMs !== undefined) {
    payload.reviewDurationMs = input.reviewDurationMs;
  }

  if (input.mode !== undefined) {
    payload.mode = input.mode;
  }

  return {
    operationId: idempotencyKey,
    operationType: "review",
    createdAt: reviewedAt,
    payload,
  };
}

interface OfflineQueueState {
  queue: QueueState;
  initialize: () => Promise<void>;
  enqueue: (operation: ReviewSyncOperation) => void;
  markInFlight: (operationIds: string[]) => void;
  finalizeSync: (
    acceptedOperationIds: string[],
    rejectedOperationIds: string[],
    serverTimestamp: string
  ) => void;
  restoreInFlight: (operationIds?: string[]) => void;
  setSyncing: (syncing: boolean) => void;
  /** Hinweis auf endgültig abgelehnte Wiederholungen zur Kenntnis genommen. */
  acknowledgeRejected: () => void;
  clear: () => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>((set, get) => ({
  queue: initialQueueState,
  initialize: async () => {
    if (get().queue.hydrated) {
      return;
    }

    try {
      const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedQueueState;
        // Beim Laden kann nichts wirklich „unterwegs" sein: Die App wurde neu
        // gestartet, die Anfrage von damals gibt es nicht mehr. Alles aus
        // inFlight gehört zurück nach pending — sonst bliebe es dort liegen und
        // würde nie wieder verschickt. Das rettet auch Einträge, die ein
        // älterer Build dort hat hängen lassen.
        set({
          queue: requeueInFlight({
            pending: parsed.pending ?? [],
            inFlight: parsed.inFlight ?? [],
            lastSyncedAt: parsed.lastSyncedAt ?? null,
            rejectedCount: parsed.rejectedCount ?? 0,
            hydrated: true,
            syncing: false,
          }),
        });
        return;
      }
    } catch {
      // Fall through to a clean queue.
    }

    set({
      queue: {
        ...initialQueueState,
        hydrated: true,
      },
    });
  },
  enqueue: (operation) =>
    applyQueueUpdate(set, (queue) => enqueueOperation(queue, operation)),
  markInFlight: (operationIds) =>
    applyQueueUpdate(set, (queue) => markOperationsInFlight(queue, operationIds)),
  finalizeSync: (acceptedOperationIds, rejectedOperationIds, serverTimestamp) =>
    applyQueueUpdate(set, (queue) =>
      finalizeOperations(
        {
          ...queue,
          syncing: false,
        },
        acceptedOperationIds,
        rejectedOperationIds,
        serverTimestamp
      )
    ),
  restoreInFlight: (operationIds) =>
    applyQueueUpdate(set, (queue) =>
      requeueInFlight(
        {
          ...queue,
          syncing: false,
        },
        operationIds
      )
    ),
  setSyncing: (syncing) =>
    set((state) => ({
      queue: {
        ...state.queue,
        syncing,
      },
    })),
  acknowledgeRejected: () =>
    applyQueueUpdate(set, (queue) =>
      queue.rejectedCount === 0 ? queue : { ...queue, rejectedCount: 0 }
    ),
  clear: () =>
    {
      const queue = {
        ...initialQueueState,
        hydrated: true,
      };
      void persistQueue(queue);
      set({ queue });
    },
}));

export async function syncPendingReviewOperations(
  userId: string
): Promise<{
  synced: number;
  /** Endgültig abgelehnt — aus der Warteschlange entfernt, zählt nie mehr. */
  rejected: number;
  /** Vorübergehend gescheitert — liegt wieder in pending, kommt beim nächsten Anlauf dran. */
  retrying: number;
} | null> {
  await useOfflineQueueStore.getState().initialize();

  const state = useOfflineQueueStore.getState();
  if (state.queue.syncing) {
    return null;
  }

  const pending = state.queue.pending.filter(
    (operation) => operation.payload.userId === userId
  );

  if (pending.length === 0) {
    return null;
  }

  const operationIds = pending.map((operation) => operation.operationId);
  state.setSyncing(true);
  state.markInFlight(operationIds);

  try {
    const result = await syncReviewOperations(userId, pending);
    useOfflineQueueStore.getState().finalizeSync(
      result.acceptedOperationIds,
      result.rejectedOperationIds,
      result.serverTimestamp
    );
    // Bewusst ABGELEITET statt aus einem neuen Antwortfeld gelesen: Diese Zahl
    // stimmt dadurch immer exakt mit dem überein, was finalizeSync gerade
    // zurück in die Warteschlange gelegt hat — und sie stimmt auch gegen einen
    // älteren Server, der failedOperationIds noch gar nicht kennt.
    const retrying =
      pending.length -
      result.acceptedOperationIds.length -
      result.rejectedOperationIds.length;

    return {
      synced: result.acceptedOperationIds.length,
      rejected: result.rejectedOperationIds.length,
      retrying: Math.max(retrying, 0),
    };
  } catch (error) {
    useOfflineQueueStore.getState().restoreInFlight(operationIds);
    throw error;
  }
}
