import { describe, expect, it } from "vitest";
import { landingCtas } from "./landing";

describe("landing CTA configuration", () => {
  it("uses a direct mail CTA for TestFlight requests", () => {
    expect(landingCtas.primary.href).toMatch(/^mailto:office@ostheimer\.at/);
    expect(landingCtas.primary.href).toContain("subject=clearn%20TestFlight");
    expect(landingCtas.primary.event.event).toBe("testflight_request");
    expect(landingCtas.primary.event.source).toBe("hero");
  });

  it("keeps a support fallback for users who need context first", () => {
    expect(landingCtas.secondary.href).toBe("/support#beta");
  });
});
