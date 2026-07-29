/**
 * Anzeige-Regeln für Tarif/Paywall/LP-Fenster (#607).
 *
 * Nagelt fest: Pro/Lifetime sehen weder Werbe-Ausweg noch Upgrade, Lifetime
 * heißt im Etikett „Lifetime" (nicht „Pro"), und die Pack-Umrechnung nutzt
 * den echten Scan-Preis des Tarifs statt der harten „/10"-Rechnung.
 */

import { describe, expect, it } from "vitest";
import {
  isPaidTier,
  lpInsufficientOptions,
  packUnavailableBodyKey,
  paywallSubtitleKey,
  scansForLpPack,
  showsPaidUntil,
  tierLabelKey,
} from "./proDisplay";
import { resources } from "../../i18n/resources";

describe("lpInsufficientOptions", () => {
  it("offers ad and upgrade only to free accounts", () => {
    expect(lpInsufficientOptions("free")).toEqual({ showWatchAd: true, showUpgrade: true });
    expect(lpInsufficientOptions("pro")).toEqual({ showWatchAd: false, showUpgrade: false });
    expect(lpInsufficientOptions("lifetime")).toEqual({ showWatchAd: false, showUpgrade: false });
  });
});

describe("paywallSubtitleKey", () => {
  it("confirms instead of upselling for paid tiers", () => {
    expect(paywallSubtitleKey("free")).toBe("paywall.subtitle");
    expect(paywallSubtitleKey("pro")).toBe("paywall.subtitlePro");
    expect(paywallSubtitleKey("lifetime")).toBe("paywall.subtitlePro");
  });
});

describe("tierLabelKey", () => {
  it("labels lifetime as Lifetime, not Pro (#607)", () => {
    expect(tierLabelKey("lifetime")).toBe("paywall.tierLifetime");
    // Der Schlüssel existierte schon, zeigte aber „Pro" — Regression-Pin auf
    // den Wortlaut in beiden Sprachen.
    expect(resources.de.translation["paywall.tierLifetime"]).toBe("Lifetime");
    expect(resources.en.translation["paywall.tierLifetime"]).toBe("Lifetime");
  });
});

describe("scansForLpPack", () => {
  it("uses the tier's real scan price", () => {
    expect(scansForLpPack(300, 10)).toBe(30);
    expect(scansForLpPack(300, 5)).toBe(60);
    expect(scansForLpPack(100, 8)).toBe(12);
  });

  it("falls back to the free price while limits are not loaded yet", () => {
    expect(scansForLpPack(300, 0)).toBe(30);
  });
});

describe("showsPaidUntil", () => {
  it("shows a date only for a subscription with expiry", () => {
    expect(showsPaidUntil("pro", "2026-08-12T00:00:00.000Z")).toBe(true);
    expect(showsPaidUntil("pro", null)).toBe(false);
    expect(showsPaidUntil("lifetime", "2026-08-12T00:00:00.000Z")).toBe(false);
    expect(showsPaidUntil("free", "2026-08-12T00:00:00.000Z")).toBe(false);
  });
});

describe("packUnavailableBodyKey", () => {
  it("stops advising ads and Pro upgrades to paid accounts", () => {
    expect(packUnavailableBodyKey("free")).toBe("lp.purchaseUnavailableBody");
    expect(packUnavailableBodyKey("pro")).toBe("lp.purchaseUnavailableBodyPro");
    expect(packUnavailableBodyKey("lifetime")).toBe("lp.purchaseUnavailableBodyPro");
    // Der Pro-Text darf weder Werbung noch Upgrade empfehlen.
    const proBody = resources.de.translation["lp.purchaseUnavailableBodyPro"];
    expect(proBody).not.toMatch(/Werbung|upgrade/i);
  });
});

describe("isPaidTier", () => {
  it("treats pro and lifetime as paid", () => {
    expect(isPaidTier("free")).toBe(false);
    expect(isPaidTier("pro")).toBe(true);
    expect(isPaidTier("lifetime")).toBe(true);
  });
});
