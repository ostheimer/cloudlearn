export const resources = {
  de: {
    translation: {
      appTitle: "clearn",
      loginTitle: "Willkommen bei clearn",
      loginButton: "Anmelden",
      registerButton: "Registrieren",
      forgotPassword: "Passwort vergessen?",
      emailLabel: "E-Mail",
      passwordLabel: "Passwort",
      confirmPasswordLabel: "Passwort bestätigen",
      noAccount: "Noch kein Konto?",
      hasAccount: "Bereits ein Konto?",
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
      loginButton: "Sign in",
      registerButton: "Sign up",
      forgotPassword: "Forgot password?",
      emailLabel: "Email",
      passwordLabel: "Password",
      confirmPasswordLabel: "Confirm password",
      noAccount: "Don't have an account?",
      hasAccount: "Already have an account?",
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
