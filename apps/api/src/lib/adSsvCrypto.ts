import { createVerify } from "node:crypto";

// Pure crypto for AdMob Server-Side Verification, kept dependency-free so it can be
// unit-tested in isolation (no DB / env imports).
//
// AdMob signs the SSV callback with ECDSA over SHA-256, DER-encoded, using a P-256
// key. `content` is the callback query string up to (excluding) `&signature=`.
// `pem` is the matching public key from https://gstatic.com/admob/reward/verifier-keys.json.
export function verifyAdSsvSignature(
  content: string,
  signatureB64: string,
  pem: string
): boolean {
  try {
    // AdMob URL-encodes the signature (base64url); normalise to standard base64.
    const normalized = signatureB64.replace(/-/g, "+").replace(/_/g, "/");
    const signature = Buffer.from(normalized, "base64");
    if (signature.length === 0) return false;
    const verifier = createVerify("SHA256");
    verifier.update(content, "utf8");
    verifier.end();
    return verifier.verify(pem, signature);
  } catch {
    return false;
  }
}
