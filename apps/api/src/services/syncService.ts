import { syncRequestSchema, type SyncResponse } from "@/lib/contracts";
import { storeReview } from "./reviewService";

export async function syncOperations(
  input: unknown,
  requestId: string
): Promise<SyncResponse> {
  const parsed = syncRequestSchema.parse(input);
  const acceptedOperationIds: string[] = [];
  const rejectedOperationIds: string[] = [];

  for (const operation of parsed.operations) {
    if (
      operation.operationType !== "review" ||
      !("idempotencyKey" in operation.payload)
    ) {
      rejectedOperationIds.push(operation.operationId);
      continue;
    }

    try {
      await storeReview(
        {
          ...operation.payload,
          userId: parsed.userId,
        },
        requestId
      );
      acceptedOperationIds.push(operation.operationId);
    } catch {
      rejectedOperationIds.push(operation.operationId);
    }
  }

  return {
    requestId,
    acceptedOperationIds,
    rejectedOperationIds,
    serverTimestamp: new Date().toISOString(),
  };
}
