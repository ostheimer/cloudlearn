import { describe, expect, it, vi } from "vitest";
import { getStableImportAttemptKey } from "./importAttemptIdempotency";

describe("getStableImportAttemptKey", () => {
  it("reuses the key when retrying the same scan/import input", () => {
    const createKey = vi.fn((prefix: string) => `${prefix}-first`);
    const first = getStableImportAttemptKey(null, "text:abc", "scan", createKey);
    const retry = getStableImportAttemptKey(first, "text:abc", "scan", createKey);

    expect(retry).toBe(first);
    expect(retry.key).toBe("scan-first");
    expect(createKey).toHaveBeenCalledTimes(1);
  });

  it("creates a new key after the scan/import input changes", () => {
    const first = getStableImportAttemptKey(
      null,
      "url:https://example.com/a",
      "import-url",
      (prefix) => `${prefix}-first`
    );
    const second = getStableImportAttemptKey(
      first,
      "url:https://example.com/b",
      "import-url",
      (prefix) => `${prefix}-second`
    );

    expect(second).not.toBe(first);
    expect(second.key).toBe("import-url-second");
  });
});
