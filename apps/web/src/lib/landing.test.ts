import { describe, expect, it } from "vitest";
import { landingCtas } from "./landing";

describe("landing CTA configuration", () => {
  it("links directly to the publicly available iPhone app", () => {
    expect(landingCtas.primary.href).toBe("https://apps.apple.com/app/id6766691399");
  });

  it("keeps a support fallback for users who need context first", () => {
    expect(landingCtas.secondary.href).toBe("/support#beta");
  });
});
