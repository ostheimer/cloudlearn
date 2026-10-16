import { describe, expect, it } from "vitest";
import { aiRequestIdentity } from "@/lib/aiRequestIdentity";
const body = { idempotencyKey: "client-key-123", extractedText: "Ähnliche Zellen", preview: true };
describe("AI identities", () => {
  it("scopes cached results to authenticated user and operation", () => {
    const a = aiRequestIdentity("a", "aiScan", body);
    expect(aiRequestIdentity("b", "aiScan", body).key).not.toBe(a.key);
    expect(aiRequestIdentity("a", "pdfImport", body).key).not.toBe(a.key);
    expect(aiRequestIdentity("a", "aiScan", { ...body, extractedText: "Anderer Text" }).key).not.toBe(a.key);
  });
  it("deduplicates concurrent content with different keys, ignoring injected userId and property order", () => {
    const a = aiRequestIdentity("a", "aiScan", body);
    const b = aiRequestIdentity("a", "aiScan", { preview: true, userId: "wrong", extractedText: body.extractedText, idempotencyKey: "different-key" });
    expect(b.fingerprint).toBe(a.fingerprint); expect(b.key).not.toBe(a.key);
  });
  it("requires a valid client key and does not put source content into DB keys", () => {
    expect(() => aiRequestIdentity("a", "scan", { ...body, idempotencyKey: "" })).toThrow();
    expect(aiRequestIdentity("a", "scan", body).key).not.toContain(body.extractedText);
  });
});
