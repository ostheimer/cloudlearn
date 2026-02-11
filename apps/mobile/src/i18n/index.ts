import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources";

export function initializeI18n(language: "de" | "en" = "de") {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: "de",
      interpolation: {
        escapeValue: false
      }
    });
  } else {
    void i18n.changeLanguage(language);
  }
}

export { i18n };
