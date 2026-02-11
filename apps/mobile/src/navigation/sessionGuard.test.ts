import { describe, expect, it } from "vitest";
import { resolveAuthRedirect } from "./sessionGuard";

describe("resolveAuthRedirect", () => {
  it("redirects unauthenticated users to auth", () => {
    expect(resolveAuthRedirect(false, "(tabs)")).toBe("/(auth)");
  });

  it("redirects authenticated users away from auth", () => {
    expect(resolveAuthRedirect(true, "(auth)")).toBe("/(tabs)");
  });

  it("keeps users on current group when valid", () => {
    expect(resolveAuthRedirect(true, "(tabs)")).toBeNull();
    expect(resolveAuthRedirect(false, "(auth)")).toBeNull();
  });
});
