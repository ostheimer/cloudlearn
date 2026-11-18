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
  it("matches URL requests whose image setting is ignored by the import", () => {
    const url = { idempotencyKey: body.idempotencyKey, sourceUrl: "https://example.test" };
    const a = aiRequestIdentity("a", "urlImport", { ...url, maxImages: 0 });
    const b = aiRequestIdentity("a", "urlImport", { ...url, maxImages: 4 });
    expect(b).toEqual(a);
  });

  it("matches an implicit JPEG scan and ignores text superseded by the image", () => {
    const image = { idempotencyKey: body.idempotencyKey, imageBase64: "fixture" };
    const a = aiRequestIdentity("a", "aiScan", image);
    const b = aiRequestIdentity("a", "aiScan", {
      ...image,
      imageMimeType: "image/jpeg",
      extractedText: "ignored while scanning the image",
    });
    expect(b).toEqual(a);
    expect(aiRequestIdentity("a", "aiScan", { ...image, imageMimeType: "image/png" })).not.toEqual(a);
  });

  it("matches text scans regardless of an unused image MIME type", () => {
    expect(aiRequestIdentity("a", "aiScan", { ...body, imageMimeType: "image/png" }))
      .toEqual(aiRequestIdentity("a", "aiScan", body));
  });

  it("requires a valid client key and does not put source content into DB keys", () => {
    expect(() => aiRequestIdentity("a", "scan", { ...body, idempotencyKey: "" })).toThrow();
    expect(aiRequestIdentity("a", "scan", body).key).not.toContain(body.extractedText);
  });
});
