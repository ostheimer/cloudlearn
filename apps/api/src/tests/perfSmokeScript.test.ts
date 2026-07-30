import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseHttpArgs, percentile, run } from "../../../../scripts/perf-smoke";

describe("scripts/perf-smoke", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs the in-process smoke check and records generated-card latency", async () => {
    await expect(run()).resolves.toBeUndefined();

    const output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain('"check": "perf-smoke"');
    expect(output).toContain('"scanLatencyMs"');
    expect(output).toContain('"reviewLatencyMs"');
    expect(output).toContain("[perf-smoke] in-process sanity check passed");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

// Der HTTP-Modus (#86) ist die ECHTE Messung. Seine Rechenteile stehen hier unter
// Test, damit ein falsches Perzentil nicht still ein zu grosszuegiges Ergebnis
// meldet — genau die Sorte Attrappe, die #86 abschaffen sollte.
describe("scripts/perf-smoke: HTTP-Modus", () => {
  describe("percentile", () => {
    it("nimmt den Nearest-Rank-Wert, unabhaengig von der Eingabe-Reihenfolge", () => {
      const values = [50, 10, 40, 20, 30];
      expect(percentile(values, 50)).toBe(30);
      // ceil(0.95 * 5) = 5 → der schlechteste der fuenf Werte
      expect(percentile(values, 95)).toBe(50);
    });

    it("laeuft bei 100 Werten nicht ueber das Ende der Liste hinaus", () => {
      const values = Array.from({ length: 100 }, (_, index) => index + 1);
      expect(percentile(values, 95)).toBe(95);
      expect(percentile(values, 100)).toBe(100);
    });

    it("liefert NaN statt einer erfundenen Zahl, wenn nichts gemessen wurde", () => {
      expect(percentile([], 95)).toBeNaN();
    });
  });

  describe("parseHttpArgs", () => {
    it("nutzt Standardwerte und schneidet den Schrägstrich am Ende ab", () => {
      const options = parseHttpArgs(["--http", "--base-url=https://example.test/"]);
      expect(options).toMatchObject({
        baseUrl: "https://example.test",
        samples: 20,
        warmup: 2,
        publicOnly: false,
      });
    });

    it("uebernimmt eigene Werte", () => {
      const options = parseHttpArgs(["--http", "--samples=50", "--warmup=0", "--public-only"]);
      expect(options).toMatchObject({ samples: 50, warmup: 0, publicOnly: true });
    });

    it("weist zu kleine Stichproben ab, statt ein geratenes P95 zu melden", () => {
      expect(() => parseHttpArgs(["--http", "--samples=2"])).toThrow(/mindestens|ab 5/i);
      expect(() => parseHttpArgs(["--http", "--samples=zwanzig"])).toThrow();
    });

    it("weist eine negative Aufwaermzahl ab", () => {
      expect(() => parseHttpArgs(["--http", "--warmup=-1"])).toThrow(/warmup/);
    });
  });
});
