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
}

interface PersistedQueueState {
  pending: ReviewSyncOperation[];
  inFlight: ReviewSyncOperation[];
  lastSyncedAt: string | null;
}

const initialQueueState: QueueState = {
  pending: [],
  inFlight: [],
  hydrated: false,
  syncing: false,
  lastSyncedAt: null,
};

function toPersistedQueue(queue: QueueState): PersistedQueueState {
  return {
    pending: queue.pending,
    inFlight: queue.inFlight,
    lastSyncedAt: queue.lastSyncedAt,
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

  if (finished.size === 0) {
    return {
      ...state,
      lastSyncedAt: serverTimestamp,
    };
  }

  return {
    ...state,
    pending: state.pending.filter(
      (operation) => !finished.has(operation.operationId)
    ),
    inFlight: state.inFlight.filter(
      (operation) => !finished.has(operation.operationId)
    ),
    lastSyncedAt: serverTimestamp,
  };
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
        set({
          queue: {
            pending: parsed.pending ?? [],
            inFlight: parsed.inFlight ?? [],
            lastSyncedAt: parsed.lastSyncedAt ?? null,
            hydrated: true,
            syncing: false,
          },
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
  rejected: number;
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
    return {
      synced: result.acceptedOperationIds.length,
      rejected: result.rejectedOperationIds.length,
    };
  } catch (error) {
    useOfflineQueueStore.getState().restoreInFlight(operationIds);
    throw error;
  }
}
