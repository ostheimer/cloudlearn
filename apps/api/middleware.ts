import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Allow cross-origin requests from mobile app, web app, and localhost dev
const ALLOWED_ORIGINS = [
  "https://clearn-web.vercel.app",
  "http://localhost:3000",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:8083",
  "http://localhost:19006",
];

function getCorsHeaders(origin: string | null) {
  const isAllowed =
    !origin || // Allow requests with no origin (mobile apps, curl)
    ALLOWED_ORIGINS.includes(origin) ||
    origin.endsWith(".vercel.app");

  return {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-request-id, x-idempotency-key",
    "Access-Control-Max-Age": "86400",
  };
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");

  // Handle preflight OPTIONS requests
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }

  // Add CORS headers to all API responses
  const response = NextResponse.next();
  const corsHeaders = getCorsHeaders(origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
