import { create } from "zustand";
import { acknowledgeOperations, enqueueOperation, initialQueueState, type QueueState } from "@clearn/domain";
import type { SyncOperation } from "@clearn/contracts";

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
      queue: enqueueOperation(state.queue, operation)
    })),
  acknowledge: (operationIds) =>
    set((state) => ({
      queue: acknowledgeOperations(state.queue, operationIds)
    })),
  clear: () => set({ queue: initialQueueState })
}));
