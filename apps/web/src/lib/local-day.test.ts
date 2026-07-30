import { describe, expect, it } from "vitest";
import { todayLocal, USER_TIMEZONE } from "./local-day";

/**
 * Spiegelt apps/mobile/src/lib/localDay.test.ts — „heute" entsteht in der
 * Server-Zeitzone, nicht in der des Browsers (#612).
 */
describe("todayLocal — Tagesgrenze in der Server-Zeitzone", () => {
  it("nutzt dieselbe Zone wie der Server", () => {
    expect(USER_TIMEZONE).toBe("Europe/Berlin");
  });

  it("zählt 23:30 Berliner Zeit noch zum laufenden Tag", () => {
    expect(todayLocal(new Date("2026-07-12T21:30:00Z"))).toBe("2026-07-12");
  });

  it("beginnt den neuen Tag mit Berliner Mitternacht, nicht mit UTC-Mitternacht", () => {
    expect(todayLocal(new Date("2026-07-12T22:30:00Z"))).toBe("2026-07-13");
    expect(todayLocal(new Date("2026-07-13T00:00:00Z"))).toBe("2026-07-13");
  });

  it("beachtet die Winterzeit (nur eine Stunde Versatz)", () => {
    expect(todayLocal(new Date("2026-01-12T23:30:00Z"))).toBe("2026-01-13");
    expect(todayLocal(new Date("2026-01-12T22:30:00Z"))).toBe("2026-01-12");
  });
});
