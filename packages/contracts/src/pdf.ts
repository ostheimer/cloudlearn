import { z } from "zod";

export const pdfImportJobSchema = z.object({
  jobId: z.string().min(8),
  userId: z.string().uuid(),
  fileName: z.string().min(1),
  pageCount: z.number().int().positive(),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  retries: z.number().int().nonnegative().default(0)
});

export type PdfImportJob = z.infer<typeof pdfImportJobSchema>;
