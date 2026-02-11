import { syncRequestSchema, type SyncResponse } from "@/lib/contracts";
import { storeReview } from "./reviewService";

export function syncOperations(input: unknown, requestId: string): SyncResponse {
  const parsed = syncRequestSchema.parse(input);
  const acceptedOperationIds: string[] = [];
  const rejectedOperationIds: string[] = [];

  for (const operation of parsed.operations) {
    try {
      if (operation.operationType === "review") {
        storeReview(operation.payload, requestId);
      }
      acceptedOperationIds.push(operation.operationId);
    } catch {
      rejectedOperationIds.push(operation.operationId);
    }
  }

  return {
    requestId,
    acceptedOperationIds,
    rejectedOperationIds,
    serverTimestamp: new Date().toISOString()
  };
}
