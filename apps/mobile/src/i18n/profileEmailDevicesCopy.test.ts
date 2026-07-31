import { beforeAll, describe, expect, it } from "vitest";
import i18next, { type i18n as I18nInstance } from "i18next";
import { resources } from "./resources";

/**
 * Wortlaute für „E-Mail-Adresse ändern" und die Geräte-Übersicht (#614).
 *
 * Zwei Aussagen dürfen NICHT verloren gehen, weil sie sonst zu Falschangaben
 * werden:
 *  - Die Adresse ändert sich erst mit dem Klick im Bestätigungs-Mail.
 *  - Die Geräte-Liste kennt nur App-Installationen mit Benachrichtigungen;
 *    ein Browser steht dort nie.
 */
let de: I18nInstance;
let en: I18nInstance;

beforeAll(async () => {
  de = i18next.createInstance();
  await de.init({ resources, lng: "de", fallbackLng: "de", interpolation: { escapeValue: false } });
  en = i18next.createInstance();
  await en.init({ resources, lng: "en", fallbackLng: "de", interpolation: { escapeValue: false } });
});

describe("E-Mail-Adresse ändern (#614)", () => {
  it("sagt, dass die Änderung erst mit dem Klick gilt", () => {
    const text = de.t("profile.changeEmailSentBody", { email: "neu@example.de" });
    expect(text).toContain("neu@example.de");
    // Ohne diesen Halbsatz würde man sich wundern, warum die Anmeldung noch
    // die alte Adresse verlangt.
    expect(text).toContain("ändert sich erst");
    expect(en.t("profile.changeEmailSentBody", { email: "neu@example.de" })).toContain(
      "only changes once you click"
    );
  });

  it("hat für jeden Schritt einen Satz", () => {
    for (const key of [
      "profile.changeEmail",
      "profile.changeEmailTitle",
      "profile.changeEmailLabel",
      "profile.changeEmailSubmit",
      "profile.changeEmailErrorTitle",
      "profile.changeEmailSentTitle",
    ]) {
      expect(de.t(key), key).not.toBe(key);
      expect(en.t(key), key).not.toBe(key);
    }
  });
});

describe("Geräte-Übersicht (#614)", () => {
  it("nennt die Grenze der Liste ausdrücklich", () => {
    // „Deine Geräte" wäre falsch: Der eigene Browser taucht nie auf, weil das
    // Web keine Push-Token registriert.
    expect(de.t("devices.title")).toBe("Geräte mit der clearn-App");
    // Erst was drinsteht, dann was fehlt — Vorschlag der #571-Sitzung.
    expect(de.t("devices.note")).toContain("Ein Browser erscheint hier nie");
    expect(en.t("devices.title")).toBe("Devices with the clearn app");
    expect(en.t("devices.note")).toContain("A browser never appears here");
  });

  it("unterscheidet „noch kein Gerät\" von „konnte nicht laden\"", () => {
    expect(de.t("devices.empty")).not.toBe(de.t("devices.loadError"));
    expect(de.t("devices.loadError")).toContain("nicht geladen");
  });

  it("behauptet im Leerzustand NICHT, es gäbe kein Gerät", () => {
    // Wer die App auf dem Handy hat, aber Benachrichtigungen abgelehnt hat,
    // sähe bei „Keine Geräte" eine Unwahrheit. Der Satz nennt deshalb den
    // Grund, nicht die vermeintliche Abwesenheit.
    expect(de.t("devices.empty")).toBe("Noch kein Gerät hat Benachrichtigungen erlaubt.");
    expect(de.t("devices.empty")).not.toMatch(/^Keine Ger/);
    expect(en.t("devices.empty")).toBe("No device has allowed notifications yet.");
  });

  it("setzt das Datum in die Zeile ein", () => {
    expect(de.t("devices.lastSeen", { date: "7. Juli 2026" })).toBe(
      "zuletzt aktiv am 7. Juli 2026"
    );
  });
});
