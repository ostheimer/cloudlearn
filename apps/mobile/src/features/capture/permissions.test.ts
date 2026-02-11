import { describe, expect, it } from "vitest";
import { canUseCapture, getCaptureFallbackMessage } from "./permissions";

describe("capture permissions", () => {
  it("allows capture when gallery or camera is granted", () => {
    expect(canUseCapture({ camera: "granted", gallery: "denied" })).toBe(true);
    expect(canUseCapture({ camera: "denied", gallery: "granted" })).toBe(true);
    expect(canUseCapture({ camera: "denied", gallery: "denied" })).toBe(false);
  });

  it("returns meaningful fallback messages", () => {
    expect(
      getCaptureFallbackMessage({ camera: "denied", gallery: "granted" }).toLocaleLowerCase()
    ).toContain("galerie");
  });
});
