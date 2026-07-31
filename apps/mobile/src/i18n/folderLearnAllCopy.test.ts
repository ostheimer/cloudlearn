import { beforeAll, describe, expect, it } from "vitest";
import i18next, { type i18n as I18nInstance } from "i18next";
import { resources } from "./resources";

/**
 * „Alle 1 lernen" war falsches Deutsch (#703). Der Knopf steht in der
 * Ordner-Ansicht und zeigt die Gesamtzahl der Karten — bei genau einer Karte
 * braucht es eine eigene Form.
 */
let de: I18nInstance;
let en: I18nInstance;

beforeAll(async () => {
  de = i18next.createInstance();
  await de.init({ resources, lng: "de", fallbackLng: "de", interpolation: { escapeValue: false } });
  en = i18next.createInstance();
  await en.init({ resources, lng: "en", fallbackLng: "de", interpolation: { escapeValue: false } });
});

describe("Ordner: Alle-lernen-Knopf (#703)", () => {
  it("hat eine eigene Einzahlform", () => {
    expect(de.t("folderDetail.learnAllCards", { count: 1 })).toBe("Die eine Karte lernen");
    expect(de.t("folderDetail.learnAllCards", { count: 1 })).not.toBe("Alle 1 lernen");
    expect(en.t("folderDetail.learnAllCards", { count: 1 })).toBe("Learn the one card");
  });

  it("bleibt in der Mehrzahl unverändert", () => {
    expect(de.t("folderDetail.learnAllCards", { count: 12 })).toBe("Alle 12 lernen");
    expect(de.t("folderDetail.learnAllCards", { count: 640 })).toBe("Alle 640 lernen");
    expect(en.t("folderDetail.learnAllCards", { count: 12 })).toBe("Learn all 12");
  });
});
