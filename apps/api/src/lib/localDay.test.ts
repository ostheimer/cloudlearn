import { describe, it, expect } from "vitest";
import { todayLocal, daysBetween, startOfLocalDayIso, startOfTodayLocalIso } from "./localDay";

describe("todayLocal (Europe/Berlin)", () => {
  it("rolls to the next day at Berlin midnight, not UTC midnight (summer, UTC+2)", () => {
    // 23:30 UTC = 01:30 Berlin the NEXT day
    expect(todayLocal(new Date("2026-07-12T23:30:00Z"))).toBe("2026-07-13");
    // 21:30 UTC = 23:30 Berlin the SAME day
    expect(todayLocal(new Date("2026-07-12T21:30:00Z"))).toBe("2026-07-12");
  });

  it("handles winter time (UTC+1)", () => {
    // 23:30 UTC = 00:30 Berlin next day
    expect(todayLocal(new Date("2026-01-10T23:30:00Z"))).toBe("2026-01-11");
    // 22:30 UTC = 23:30 Berlin same day
    expect(todayLocal(new Date("2026-01-10T22:30:00Z"))).toBe("2026-01-10");
  });
});

describe("daysBetween", () => {
  it("computes whole-day differences", () => {
    expect(daysBetween("2026-07-12", "2026-07-13")).toBe(1);
    expect(daysBetween("2026-07-12", "2026-07-12")).toBe(0);
    expect(daysBetween("2026-07-12", "2026-07-20")).toBe(8);
    expect(daysBetween("2026-07-13", "2026-07-12")).toBe(-1);
  });

  it("crosses month and year boundaries", () => {
    expect(daysBetween("2026-06-30", "2026-07-01")).toBe(1);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });
});

describe("startOfLocalDayIso", () => {
  it("maps a summer date to 22:00Z of the previous day (UTC+2)", () => {
    expect(startOfLocalDayIso("2026-07-01")).toBe("2026-06-30T22:00:00.000Z");
  });

  it("maps a winter date to 23:00Z of the previous day (UTC+1)", () => {
    expect(startOfLocalDayIso("2026-01-15")).toBe("2026-01-14T23:00:00.000Z");
  });

  it("uses the offset valid at that day's own midnight around a DST switch", () => {
    // Summer time starts 2026-03-29 in Berlin; midnight of that day is still UTC+1.
    expect(startOfLocalDayIso("2026-03-29")).toBe("2026-03-28T23:00:00.000Z");
    // The following day is fully UTC+2.
    expect(startOfLocalDayIso("2026-03-30")).toBe("2026-03-29T22:00:00.000Z");
  });
});

describe("startOfTodayLocalIso", () => {
  it("is Berlin midnight expressed in UTC (summer: 22:00Z previous day)", () => {
    expect(startOfTodayLocalIso(new Date("2026-07-13T10:00:00Z"))).toBe(
      "2026-07-12T22:00:00.000Z"
    );
  });

  it("is Berlin midnight expressed in UTC (winter: 23:00Z previous day)", () => {
    expect(startOfTodayLocalIso(new Date("2026-01-11T10:00:00Z"))).toBe(
      "2026-01-10T23:00:00.000Z"
    );
  });

  it("late-evening UTC already belongs to the next Berlin day", () => {
    // 23:30 UTC on the 12th = 01:30 Berlin on the 13th, whose day started 22:00Z
    expect(startOfTodayLocalIso(new Date("2026-07-12T23:30:00Z"))).toBe(
      "2026-07-12T22:00:00.000Z"
    );
  });
});
