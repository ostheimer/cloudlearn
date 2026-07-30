import { describe, expect, it } from "vitest";
import { todayLocal, USER_TIMEZONE } from "./localDay";

/**
 * „Heute" muss in derselben Zeitzone entstehen, in der der Server die
 * Streak-Tage stempelt (#612) — sonst behauptet die Startseite auf Reisen, es
 * sei heute noch nicht gelernt worden (oder umgekehrt).
 *
 * Die Tests fixieren echte Instanzen: Sie gelten unabhängig davon, in welcher
 * Zeitzone der Test-Rechner steht.
 */
describe("todayLocal — Tagesgrenze in der Server-Zeitzone", () => {
  it("nutzt dieselbe Zone wie der Server", () => {
    expect(USER_TIMEZONE).toBe("Europe/Berlin");
  });

  it("zählt 23:30 Berliner Zeit noch zum laufenden Tag", () => {
    // 21:30 UTC = 23:30 Berliner Sommerzeit.
    expect(todayLocal(new Date("2026-07-12T21:30:00Z"))).toBe("2026-07-12");
  });

  it("beginnt den neuen Tag mit Berliner Mitternacht, nicht mit UTC-Mitternacht", () => {
    // 22:30 UTC = 00:30 Berliner Zeit des Folgetags.
    expect(todayLocal(new Date("2026-07-12T22:30:00Z"))).toBe("2026-07-13");
    // Genau UTC-Mitternacht ist in Berlin schon 02:00 — derselbe Tag.
    expect(todayLocal(new Date("2026-07-13T00:00:00Z"))).toBe("2026-07-13");
  });

  it("beachtet die Winterzeit (nur eine Stunde Versatz)", () => {
    // 23:30 UTC im Januar = 00:30 Berliner Winterzeit des Folgetags.
    expect(todayLocal(new Date("2026-01-12T23:30:00Z"))).toBe("2026-01-13");
    // 22:30 UTC im Januar = 23:30 Berlin — noch derselbe Tag.
    expect(todayLocal(new Date("2026-01-12T22:30:00Z"))).toBe("2026-01-12");
  });

  it("liefert das YYYY-MM-DD-Format der Server-Streak-Tage", () => {
    expect(todayLocal(new Date("2026-03-05T10:00:00Z"))).toBe("2026-03-05");
  });
});
