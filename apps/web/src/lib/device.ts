/**
 * Erkennt Geräte, die den App-Link `clearn://` überhaupt öffnen können.
 *
 * Am Rechner tut so ein Link nichts — ohne diese Unterscheidung stünde dort
 * ein toter Knopf. Die Prüfung ist als reine Funktion herausgezogen (#609),
 * damit der Handy-Fall testbar ist statt nur im Browser sichtbar.
 */
export function isMobileUserAgent(userAgent: string, maxTouchPoints: number): boolean {
  if (/iphone|ipod|android/i.test(userAgent)) return true;
  if (/ipad/i.test(userAgent)) return true;
  // iPadOS 13+ meldet sich als "Macintosh" — nur der Touchscreen verrät das
  // iPad. Ein Mac mit angeschlossenem Touch-Display ist damit theoretisch
  // falsch erkannt; er bekäme den App-Knopf zusätzlich zum Browser-Weg
  // angeboten, käme also trotzdem weiter.
  return /macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/** Browser-Variante von `isMobileUserAgent` für Client-Komponenten. */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return isMobileUserAgent(navigator.userAgent, navigator.maxTouchPoints);
}
