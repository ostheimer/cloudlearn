import { describe, expect, it } from "vitest";
import { LP_PACKS, mapLpPackOffersById } from "./lpPackOffers";
import type { RevenueCatOffer } from "./revenuecat";

function offer(identifier: string, priceString = "0,99 €"): RevenueCatOffer {
  return {
    identifier,
    title: identifier,
    description: "",
    priceString,
    packageType: "CUSTOM",
  };
}

describe("LP pack offers", () => {
  it("keeps LP pack identifiers aligned with the API contract", () => {
    expect(LP_PACKS.map((pack) => pack.id)).toEqual([
      "lp_pack_100",
      "lp_pack_300",
      "lp_pack_750",
      "lp_pack_2000",
    ]);
  });

  it("maps only configured LP pack offerings by identifier", () => {
    const offers = [
      offer("$rc_monthly", "4,99 €"),
      offer("lp_pack_100", "0,99 €"),
      offer("lp_pack_300", "2,49 €"),
    ];

    expect(mapLpPackOffersById(offers)).toEqual({
      lp_pack_100: offer("lp_pack_100", "0,99 €"),
      lp_pack_300: offer("lp_pack_300", "2,49 €"),
    });
  });

  it("returns an empty map when RevenueCat exposes no LP packs", () => {
    expect(mapLpPackOffersById([offer("$rc_annual"), offer("$rc_lifetime")])).toEqual({});
  });
});
