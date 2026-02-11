import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { withRequestIdHeaders } from "./observability";

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
    if (error.message === "Card not found") {
      return { code: "CARD_NOT_FOUND", message: error.message, status: 404 };
    }

    return { code: "INTERNAL_ERROR", message: error.message, status: 500 };
  }
  return { code: "INTERNAL_ERROR", message: "Unknown error", status: 500 };
}
