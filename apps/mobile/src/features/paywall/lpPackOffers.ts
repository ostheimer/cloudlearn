import type { RevenueCatOffer } from "./revenuecat";

export const LP_PACKS = [
  { id: "lp_pack_100", lp: 100, popular: false },
  { id: "lp_pack_300", lp: 300, popular: true },
  { id: "lp_pack_750", lp: 750, popular: false },
  { id: "lp_pack_2000", lp: 2000, popular: false },
] as const;

export type LpPackDefinition = (typeof LP_PACKS)[number];

const LP_PACK_IDS = new Set<string>(LP_PACKS.map((pack) => pack.id));

export function mapLpPackOffersById(
  offers: readonly RevenueCatOffer[]
): Record<string, RevenueCatOffer> {
  const offersById: Record<string, RevenueCatOffer> = {};

  for (const offer of offers) {
    if (LP_PACK_IDS.has(offer.identifier)) {
      offersById[offer.identifier] = offer;
    }
  }

  return offersById;
}
