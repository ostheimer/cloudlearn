export function toGermanAuthError(message: string | null | undefined): string {
  const normalized = message?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return "Authentifizierung fehlgeschlagen. Bitte versuche es erneut.";
  }

  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials")
  ) {
    return "E-Mail oder Passwort ist falsch.";
  }

  if (
    normalized.includes("email link is invalid or has expired") ||
    normalized.includes("link is invalid or has expired") ||
    normalized.includes("expired") ||
    normalized.includes("invalid token")
  ) {
    return "Der E-Mail-Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.";
  }

  if (
    normalized.includes("email not confirmed") ||
    normalized.includes("email address not confirmed")
  ) {
    return "Bitte bestätige zuerst deine E-Mail-Adresse.";
  }

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already registered") ||
    normalized.includes("already exists")
  ) {
    return "Diese E-Mail-Adresse ist bereits registriert. Melde dich an oder setze dein Passwort zurück.";
  }

  if (
    normalized.includes("password should be at least") ||
    normalized.includes("password must be at least") ||
    normalized.includes("weak password")
  ) {
    return "Das Passwort ist zu schwach. Bitte verwende mindestens 6 Zeichen.";
  }

  if (normalized.includes("signup disabled")) {
    return "Registrierung ist derzeit deaktiviert.";
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("for security purposes")
  ) {
    return "Zu viele Versuche. Bitte warte kurz und versuche es erneut.";
  }

  if (
    normalized.includes("network") ||
    normalized.includes("fetch failed") ||
    normalized.includes("failed to fetch")
  ) {
    return "Netzwerkfehler. Bitte prüfe deine Verbindung und versuche es erneut.";
  }

  return "Authentifizierung fehlgeschlagen. Bitte versuche es erneut.";
}
