import { type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { createB2bClass, listB2bClasses } from "@/services/b2bService";

const tenantQuerySchema = z.object({
  tenantId: z.string().min(3)
});

export async function GET(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const query = tenantQuerySchema.parse({
      tenantId: request.nextUrl.searchParams.get("tenantId")
    });
    return jsonOk(requestId, { requestId, classes: listB2bClasses(query.tenantId) });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}

export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const body = await request.json();
    const created = createB2bClass(body);
    return jsonOk(requestId, { requestId, class: created }, 201);
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
