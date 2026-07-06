import { describe, expect, it } from "vitest";
import { buildShareUrl } from "@/lib/shareLink";

describe("buildShareUrl", () => {
  it("builds the share URL from the given base", () => {
    expect(buildShareUrl("abc-123", "https://clearn-web.vercel.app")).toBe(
      "https://clearn-web.vercel.app/deck/abc-123"
    );
  });

  it("trims trailing slashes from the base URL", () => {
    expect(buildShareUrl("abc", "https://example.com/")).toBe("https://example.com/deck/abc");
  });

  it("URL-encodes the token", () => {
    expect(buildShareUrl("a/b c", "https://example.com")).toBe(
      "https://example.com/deck/a%2Fb%20c"
    );
  });

  it("defaults to a reachable host instead of the unregistered clearn.ai domain", () => {
    expect(buildShareUrl("token-1")).toBe("https://clearn-web.vercel.app/deck/token-1");
  });
});
