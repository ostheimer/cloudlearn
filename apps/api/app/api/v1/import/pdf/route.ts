import { type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { enqueuePdfImport, getPdfJob } from "@/services/pdfImportService";

const createPdfJobSchema = z.object({
  userId: z.string().uuid(),
  fileName: z.string().min(1),
  pageCount: z.number().int().positive()
});

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  const jobId = request.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return jsonError(requestId, "MISSING_JOB_ID", "jobId is required", 400);
  }

  const job = getPdfJob(jobId);
  if (!job) {
    return jsonError(requestId, "JOB_NOT_FOUND", "PDF import job not found", 404);
  }

  return jsonOk(requestId, { requestId, job });
}

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const parsed = createPdfJobSchema.parse(await request.json());
    const job = enqueuePdfImport(parsed.userId, parsed.fileName, parsed.pageCount);
    return jsonOk(requestId, { requestId, job }, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
