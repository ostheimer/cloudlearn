export const resources = {
  de: {
    translation: {
      appTitle: "clearn",
      loginTitle: "Willkommen bei clearn",
      loginButton: "Mit Demo-Konto anmelden",
      scanTab: "Scan",
      learnTab: "Lernen",
      decksTab: "Decks",
      profileTab: "Profil",
      captureHeadline: "Foto aufnehmen oder importieren",
      ocrHeadline: "OCR Text bearbeiten",
      reviewHeadline: "Lernsession",
      signOut: "Abmelden"
    }
  },
  en: {
    translation: {
      appTitle: "clearn",
      loginTitle: "Welcome to clearn",
      loginButton: "Sign in with demo account",
      scanTab: "Scan",
      learnTab: "Learn",
      decksTab: "Decks",
      profileTab: "Profile",
      captureHeadline: "Capture or import image",
      ocrHeadline: "Edit OCR text",
      reviewHeadline: "Study session",
      signOut: "Sign out"
    }
  }
} as const;

export type AppLanguage = keyof typeof resources;
