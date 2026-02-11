import { z } from "zod";
import { reviewRequestSchema } from "./review";

export const operationTypeSchema = z.enum(["review", "card_update", "deck_update", "delete"]);
export type OperationType = z.infer<typeof operationTypeSchema>;

export const syncOperationSchema = z.object({
  operationId: z.string().min(8).max(128),
  operationType: operationTypeSchema,
  createdAt: z.string().datetime(),
  payload: z.union([
    reviewRequestSchema,
    z.object({ cardId: z.string().uuid(), front: z.string().min(1), back: z.string().min(1) }),
    z.object({ deckId: z.string().uuid(), title: z.string().min(1) }),
    z.object({ entity: z.enum(["card", "deck"]), entityId: z.string().uuid() })
  ])
});

export type SyncOperation = z.infer<typeof syncOperationSchema>;

export const syncRequestSchema = z.object({
  userId: z.string().uuid(),
  operations: z.array(syncOperationSchema).max(500)
});

export type SyncRequest = z.infer<typeof syncRequestSchema>;

export const syncResponseSchema = z.object({
  requestId: z.string().min(8),
  acceptedOperationIds: z.array(z.string()),
  rejectedOperationIds: z.array(z.string()),
  serverTimestamp: z.string().datetime()
});

export type SyncResponse = z.infer<typeof syncResponseSchema>;
