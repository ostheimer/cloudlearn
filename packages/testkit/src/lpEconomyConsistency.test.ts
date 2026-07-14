import { beforeAll, describe, expect, it } from "vitest";

// #212: The LP economy (tier limits, costs, earn rules, pack prices) is
// intentionally duplicated across independently-deployed apps — the server
// (apps/api) is authoritative at runtime, packages/contracts mirrors it for
// shared typing, and the mobile paywall keeps its own pack list (prices come
// from the App Store, not from us). Because nothing wires these together at
// build time, they can silently drift. This guard imports the real exported
// values and fails CI the moment any of them disagree, so the "keep in sync by
// hand" rule in AGENTS.md is now machine-enforced.
//
// The imports are dynamic and built from a computed URL so that tsc does not
// pull these out-of-rootDir app files into this package's typecheck program
// (TS6059). The type-only imports inside each source file are erased at
// runtime, so loading them here drags in no framework or zod dependency.
const repoRoot = new URL("../../../", import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadModule(relPath: string): Promise<any> {
  return import(new URL(relPath, repoRoot).href);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let apiGates: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let contractGates: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mobilePacks: any;

beforeAll(async () => {
  apiGates = await loadModule("apps/api/src/lib/featureGates.ts");
  contractGates = await loadModule("packages/contracts/src/featureGates.ts");
  mobilePacks = (
    await loadModule("apps/mobile/src/features/paywall/lpPackOffers.ts")
  ).LP_PACKS;
});

describe("LP economy consistency guard (#212)", () => {
  it("keeps server and contracts tier limits identical", () => {
    expect(contractGates.TIER_LIMITS).toEqual(apiGates.TIER_LIMITS);
  });

  it("keeps server and contracts LP earn rules identical", () => {
    expect(contractGates.LP_EARN_RULES).toEqual(apiGates.LP_EARN_RULES);
  });

  it("keeps server and contracts LP packs identical", () => {
    expect(contractGates.LP_PACKS).toEqual(apiGates.LP_PACKS);
  });

  it("keeps server and contracts streak-freeze pricing identical", () => {
    expect(contractGates.STREAK_FREEZE).toEqual(apiGates.STREAK_FREEZE);
  });

  it("keeps server and contracts referral cap identical", () => {
    expect(contractGates.REFERRAL_SENDER_CAP).toBe(apiGates.REFERRAL_SENDER_CAP);
  });

  it("keeps the mobile paywall pack list aligned with the server packs", () => {
    // Mobile stores only { id, lp, popular } — the real price is fetched from
    // RevenueCat/App Store — so we compare the IDs and LP amounts, not prices.
    const serverPackLpById = apiGates.LP_PACKS as Record<
      string,
      { lp: number; priceEur: number }
    >;
    const mobilePackLpById: Record<string, number> = Object.fromEntries(
      (mobilePacks as ReadonlyArray<{ id: string; lp: number }>).map((pack) => [
        pack.id,
        pack.lp,
      ]),
    );

    expect(Object.keys(mobilePackLpById).sort()).toEqual(
      Object.keys(serverPackLpById).sort(),
    );

    for (const [id, lp] of Object.entries(mobilePackLpById)) {
      expect(serverPackLpById[id]?.lp).toBe(lp);
    }
  });
});
