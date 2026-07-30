import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { REAL_ADS_ENABLED } from "./adsMode";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * #611: Solange `REAL_ADS_ENABLED` false ist, gibt `watchAd()` garantiert
 * `{ granted: 0, mock: true }` zurück. Das LP-Fenster versprach trotzdem
 * „+5 LP sofort" samt „+5"-Plakette — ehrlich wurde erst die Antwort DANACH
 * („Belohn-LP für Werbung sind noch nicht aktiv."). Genau im Sackgassen-Moment,
 * in dem jemand dringend Punkte braucht, stand also die falsche Zahl.
 *
 * Der Shop machte es längst richtig. Diese Prüfungen halten beide Oberflächen
 * zusammen — Quelltext-Prüfung, weil die Bildschirme selbst nicht
 * gerendert werden (kein React-Test-Aufbau in dieser App) und der App-Teil bis
 * zum nächsten Build ohnehin auf keinem Gerät zu sehen ist.
 */
describe("Werbung verspricht nur, was sie hält (#611)", () => {
  const modal = readFileSync(
    join(mobileRoot, "src/components/LpInsufficientModal.tsx"),
    "utf-8",
  );
  const store = readFileSync(join(mobileRoot, "app/lp-store.tsx"), "utf-8");

  it("die Attrappe zahlt heute nichts aus — Grundlage aller Prüfungen hier", () => {
    // Kippt dieser Wert (#149), dürfen die Versprechen wieder rein; die Tests
    // unten hängen deshalb an der Konstante, nicht an einem festen `false`.
    expect(REAL_ADS_ENABLED).toBe(false);
  });

  it("das LP-Fenster kennt den Schalter überhaupt", () => {
    expect(modal).toContain('import { REAL_ADS_ENABLED } from "../features/ads/adsMode";');
  });

  it("zeigt die +5-Plakette nur bei echter Werbung", () => {
    // Die Plakette ist die auffälligste Zahl im Fenster. Sie MUSS hinter der
    // Weiche stehen, sonst behauptet sie Punkte, die nicht kommen.
    const badge = modal.slice(0, modal.indexOf("+5\n"));
    expect(badge).toMatch(/REAL_ADS_ENABLED \?\s*\(/);
  });

  it("verspricht im Untertitel keine 5 LP, wenn keine kommen", () => {
    // lp.watchAdSubtitle = „+5 LP sofort" darf nur im REAL_ADS-Zweig stehen,
    // der Attrappen-Zweig nimmt denselben Text wie der Shop.
    expect(modal).toContain('t("lp.watchAdMockSubtitle")');
    expect(modal).toMatch(/REAL_ADS_ENABLED[\s\S]{0,120}lp\.watchAdSubtitle/);
  });

  it("nennt die Kachel im Attrappen-Fall wie der Shop", () => {
    // Wortgleichheit ist hier der Punkt: Dasselbe Angebot darf in Fenster und
    // Shop nicht anders heißen.
    expect(modal).toContain('t("lp.watchAdMockFull")');
    expect(store).toContain('t("lp.watchAdMockFull")');
  });

  it("der Shop bietet Lernen als Weg an — nicht nur Werbung", () => {
    // „Jetzt LP verdienen" enthielt ausschließlich die Werbe-Kachel, also
    // ausgerechnet den Weg mit 0 Punkten. Der Lern-Weg ist jetzt der erste.
    expect(store).toContain('t("lp.earnByLearningTitle")');
    expect(store.indexOf('t("lp.earnByLearningTitle")')).toBeLessThan(
      store.indexOf('t("lp.watchAdMockFull")'),
    );
  });

  it("zeigt den Lern-Weg auch Pro-Konten", () => {
    // Der ganze Abschnitt lag in `tier === "free"` — Pro und Lifetime sahen
    // im Shop gar keinen Verdien-Weg, obwohl sie durch Lernen genauso punkten.
    const learnTile = store.indexOf('t("lp.earnByLearningTitle")');
    const freeGate = store.indexOf('{tier === "free" && (', store.indexOf('t("lp.freeEarnSection")'));
    expect(learnTile).toBeLessThan(freeGate);
  });
});
