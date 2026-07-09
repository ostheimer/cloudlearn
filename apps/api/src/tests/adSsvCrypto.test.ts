import { describe, it, expect } from "vitest";
import { generateKeyPairSync, createSign } from "node:crypto";
import { verifyAdSsvSignature } from "@/lib/adSsvCrypto";

// Sign `content` the same way AdMob does: ECDSA / SHA-256 / DER over a P-256 key.
function sign(content: string) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "P-256",
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const der = createSign("SHA256").update(content).end().sign(privateKey); // DER buffer
  return { publicKey: publicKey as string, signatureB64: der.toString("base64") };
}

// A realistic signed-content string (query params before &signature=, alphabetical).
const CONTENT =
  "ad_network=5450213213286189855&ad_unit=1234567890&reward_amount=1&reward_item=lp&timestamp=1500000000000&transaction_id=abc123&user_id=00000000-0000-4000-8000-000000000000";

describe("verifyAdSsvSignature", () => {
  it("accepts a signature made with the matching private key", () => {
    const { publicKey, signatureB64 } = sign(CONTENT);
    expect(verifyAdSsvSignature(CONTENT, signatureB64, publicKey)).toBe(true);
  });

  it("accepts AdMob's URL-safe (base64url) signature encoding", () => {
    const { publicKey, signatureB64 } = sign(CONTENT);
    const b64url = signatureB64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(verifyAdSsvSignature(CONTENT, b64url, publicKey)).toBe(true);
  });

  it("rejects when the signed content was tampered with", () => {
    const { publicKey, signatureB64 } = sign(CONTENT);
    expect(verifyAdSsvSignature(CONTENT + "&reward_amount=9999", signatureB64, publicKey)).toBe(false);
  });

  it("rejects a signature from a different key", () => {
    const { signatureB64 } = sign(CONTENT);
    const { publicKey: otherKey } = sign(CONTENT);
    expect(verifyAdSsvSignature(CONTENT, signatureB64, otherKey)).toBe(false);
  });

  it("rejects garbage / empty signatures instead of throwing", () => {
    const { publicKey } = sign(CONTENT);
    expect(verifyAdSsvSignature(CONTENT, "not-a-signature", publicKey)).toBe(false);
    expect(verifyAdSsvSignature(CONTENT, "", publicKey)).toBe(false);
  });
});
