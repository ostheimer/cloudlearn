import { z } from "zod";

export const requestIdSchema = z.string().min(8);

export const apiErrorSchema = z.object({
  code: z.string().min(3),
  message: z.string().min(3),
  request_id: requestIdSchema
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const cursorPaginationSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).default(20)
});

export type CursorPagination = z.infer<typeof cursorPaginationSchema>;
