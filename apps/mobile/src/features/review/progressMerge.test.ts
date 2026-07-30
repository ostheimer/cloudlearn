/**
 * Which "Weitermachen" entry counts — local or account (#610). Mirror of the
 * web test; the rule is short but consequential: picking the older entry
 * re-rates exactly the cards this feature exists to protect.
 */

import { describe, expect, it } from "vitest";
import { pickNewerProgress } from "./progressMerge";

const local = (savedAt?: string) => ({ from: "local" as const, ...(savedAt ? { savedAt } : {}) });
const server = (savedAt?: string) => ({ from: "account" as const, ...(savedAt ? { savedAt } : {}) });

describe("pickNewerProgress", () => {
  it("takes the newer entry", () => {
    expect(
      pickNewerProgress(local("2026-07-30T10:00:00.000Z"), server("2026-07-29T10:00:00.000Z"))
    ).toMatchObject({ from: "local" });
    expect(
      pickNewerProgress(local("2026-07-29T10:00:00.000Z"), server("2026-07-30T10:00:00.000Z"))
    ).toMatchObject({ from: "account" });
  });

  it("takes whatever exists when one side is missing", () => {
    expect(pickNewerProgress(local("2026-07-30T10:00:00.000Z"), null)).toMatchObject({
      from: "local",
    });
    expect(pickNewerProgress(null, server("2026-07-30T10:00:00.000Z"))).toMatchObject({
      from: "account",
    });
    expect(pickNewerProgress(null, null)).toBeNull();
  });

  it("treats an unstamped entry as the older one", () => {
    expect(pickNewerProgress(local(), server("2026-07-29T10:00:00.000Z"))).toMatchObject({
      from: "account",
    });
    expect(pickNewerProgress(local("2026-07-29T10:00:00.000Z"), server())).toMatchObject({
      from: "local",
    });
  });

  it("prefers the account entry on a tie or with both unstamped", () => {
    expect(pickNewerProgress(local(), server())).toMatchObject({ from: "account" });
    const same = "2026-07-30T10:00:00.000Z";
    expect(pickNewerProgress(local(same), server(same))).toMatchObject({ from: "account" });
  });

  it("is not fooled by a broken stamp", () => {
    expect(pickNewerProgress(local("not a date"), server("2026-07-29T10:00:00.000Z"))).toMatchObject(
      { from: "account" }
    );
  });
});
