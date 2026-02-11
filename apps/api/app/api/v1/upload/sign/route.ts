import { type NextRequest } from "next/server";
import { z } from "zod";
import { createSignedUploadUrl } from "@/lib/r2";
import { sanitizeFileName } from "@/lib/sanitize";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";

const signRequestSchema = z.object({
  userId: z.string().uuid(),
  fileName: z.string().min(1),
  contentType: z.string().min(3)
});

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const parsed = signRequestSchema.parse(await request.json());
    const objectPath = `${parsed.userId}/${Date.now()}-${sanitizeFileName(parsed.fileName)}`;
    const signed = createSignedUploadUrl(objectPath, parsed.contentType);
    return jsonOk(
      requestId,
      {
        requestId,
        objectPath,
        ...signed
      },
      201
    );
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
