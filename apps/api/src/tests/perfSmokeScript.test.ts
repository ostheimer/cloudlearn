import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "../../../../scripts/perf-smoke";

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
