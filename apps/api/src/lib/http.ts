import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { withRequestIdHeaders } from "./observability";

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function jsonOk<T>(requestId: string, data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status, headers: withRequestIdHeaders(requestId) });
}

export function jsonError(requestId: string, code: string, message: string, status = 400): NextResponse {
  return NextResponse.json(
    {
      code,
      message,
      request_id: requestId
    },
    { status, headers: withRequestIdHeaders(requestId) }
  );
}

export function normalizeError(error: unknown): { code: string; message: string; status: number } {
  if (error instanceof ZodError) {
    return { code: "VALIDATION_ERROR", message: error.message, status: 422 };
  }
  if (error instanceof Error) {
    const normalizedError = error as Error & { status?: unknown; code?: unknown };
    const status = typeof normalizedError.status === "number"
      ? normalizedError.status
      : undefined;
    const code = typeof normalizedError.code === "string"
      ? normalizedError.code
      : undefined;
    if (status !== undefined) {
      return {
        code: code ?? (status === 401 ? "UNAUTHORIZED" : "REQUEST_ERROR"),
        message: error.message,
        status,
      };
    }
    if (error.message === "Card not found") {
      return { code: "CARD_NOT_FOUND", message: error.message, status: 404 };
    }

    // Unclassified errors are server failures. Their original text can contain
    // table names, SQL fragments or provider details and must not cross the
    // API boundary (#702). The request id remains available for diagnostics.
    return { code: "INTERNAL_ERROR", message: "Internal server error", status: 500 };
  }
  return { code: "INTERNAL_ERROR", message: "Internal server error", status: 500 };
}
