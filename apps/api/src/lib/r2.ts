import { createHmac } from "node:crypto";
import { getEnv } from "./env";

export interface SignedUploadUrl {
  url: string;
  expiresAt: string;
}

export function createSignedUploadUrl(path: string, contentType: string): SignedUploadUrl {
  const env = getEnv();
  const ttl = env.R2_SIGNED_URL_TTL_SECONDS;
  const expiresAtMs = Date.now() + ttl * 1000;
  const expiresAt = new Date(expiresAtMs).toISOString();
  const secret = env.R2_SECRET_ACCESS_KEY ?? "dev-secret";
  const endpoint = env.R2_ENDPOINT ?? "https://example.r2.cloudflarestorage.com";
  const bucket = env.R2_BUCKET_NAME;

  const payload = `${path}:${contentType}:${expiresAtMs}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  const url = `${endpoint}/${bucket}/${path}?expires=${expiresAtMs}&signature=${signature}`;

  return { url, expiresAt };
}

export function isSignedUrlExpired(expiresAtMs: number, now = Date.now()): boolean {
  return now > expiresAtMs;
}
