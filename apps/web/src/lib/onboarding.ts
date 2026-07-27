/**
 * Erst-Start-Einführung (Onboarding) im Web.
 *
 * Die App merkt sich „Einführung erledigt" nur lokal auf dem Gerät
 * (AsyncStorage, gleicher Schlüsselname) — es gibt bewusst keinen
 * Server-Endpunkt dafür. Das Web-Gegenstück ist localStorage.
 *
 * Anders als die App zeigt das Web die Einführung nur wirklich neuen
 * Konten: Wer schon Decks besitzt, bekommt den Haken still gesetzt
 * (Laras Entscheidung 27.07.). Sonst sähe jeder Bestandsnutzer die
 * Einführung einmal pro Browser und bekäme dabei ein überflüssiges
 * zweites „Erste Karten"-Deck — die Einführung hat kein Überspringen.
 */

const ONBOARDING_STORAGE_KEY = "clearn_onboarding_completed";

export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    // localStorage kann gesperrt sein (z. B. strenger Privatmodus). Dann
    // lieber nie zeigen als bei jedem Besuch erneut.
    return true;
  }
}

export function markOnboardingCompleted(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // Ohne Speicher kein Merken — schlimmstenfalls greift beim nächsten
    // Besuch wieder die Deck-Prüfung.
  }
}

export type OnboardingDecision = "show" | "markCompleted";

/** Nur Konten ohne ein einziges Deck gelten als neu. */
export function decideOnboarding(deckCount: number): OnboardingDecision {
  return deckCount === 0 ? "show" : "markCompleted";
}

/**
 * Einmal-Notiz für die Startseiten-Begrüßung: Direkt nach der Einführung
 * sagt Home „Willkommen" statt „Willkommen zurück". sessionStorage, damit
 * die Notiz den Tab nicht überlebt — und consume löscht sie beim Lesen,
 * damit es wirklich nur den einen ersten Gruß betrifft.
 */
const WELCOME_MARKER_KEY = "clearn_onboarding_welcome";

export function rememberFreshWelcome(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(WELCOME_MARKER_KEY, "1");
  } catch {
    // Ohne Speicher bleibt es beim gewohnten „Willkommen zurück".
  }
}

export function consumeFreshWelcome(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const fresh = window.sessionStorage.getItem(WELCOME_MARKER_KEY) === "1";
    if (fresh) window.sessionStorage.removeItem(WELCOME_MARKER_KEY);
    return fresh;
  } catch {
    return false;
  }
}
