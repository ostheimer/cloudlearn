import { create } from "zustand";

// Inline types (formerly from @clearn/domain and @clearn/contracts)
// This module is a scaffold — offline sync is not yet functional.

interface SyncOperation {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

interface QueueState {
  pending: SyncOperation[];
  inFlight: SyncOperation[];
}

const initialQueueState: QueueState = {
  pending: [],
  inFlight: [],
};

function enqueueOperation(state: QueueState, op: SyncOperation): QueueState {
  return { ...state, pending: [...state.pending, op] };
}

function acknowledgeOperations(state: QueueState, ids: string[]): QueueState {
  return {
    ...state,
    inFlight: state.inFlight.filter((op) => !ids.includes(op.id)),
  };
}

interface OfflineQueueState {
  queue: QueueState;
  enqueue: (operation: SyncOperation) => void;
  acknowledge: (operationIds: string[]) => void;
  clear: () => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>((set) => ({
  queue: initialQueueState,
  enqueue: (operation) =>
    set((state) => ({
      queue: enqueueOperation(state.queue, operation),
    })),
  acknowledge: (operationIds) =>
    set((state) => ({
      queue: acknowledgeOperations(state.queue, operationIds),
    })),
  clear: () => set({ queue: initialQueueState }),
}));
