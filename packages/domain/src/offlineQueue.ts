import type { SyncOperation } from "@clearn/contracts";

export interface QueueState {
  readonly operations: SyncOperation[];
}

export const initialQueueState: QueueState = {
  operations: []
};

export function enqueueOperation(state: QueueState, operation: SyncOperation): QueueState {
  if (state.operations.some((item) => item.operationId === operation.operationId)) {
    return state;
  }

  return { operations: [...state.operations, operation] };
}

export function acknowledgeOperations(state: QueueState, operationIds: string[]): QueueState {
  if (operationIds.length === 0) {
    return state;
  }

  const accepted = new Set(operationIds);
  return { operations: state.operations.filter((item) => !accepted.has(item.operationId)) };
}
