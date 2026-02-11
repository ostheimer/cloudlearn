import { randomUUID } from "node:crypto";

export interface RequestContext {
  requestId: string;
}

export function resolveRequestId(headers: Headers): string {
  return headers.get("x-request-id") ?? randomUUID();
}

export function createRequestContext(headers: Headers): RequestContext {
  return { requestId: resolveRequestId(headers) };
}

export function logInfo(message: string, context: Record<string, unknown>): void {
  console.info(JSON.stringify({ level: "info", message, ...context }));
}

export function logError(message: string, context: Record<string, unknown>): void {
  console.error(JSON.stringify({ level: "error", message, ...context }));
}

export function withRequestIdHeaders(requestId: string): Headers {
  const headers = new Headers();
  headers.set("x-request-id", requestId);
  return headers;
}
