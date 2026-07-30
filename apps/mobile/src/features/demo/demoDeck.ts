import { wasKnown, type ReviewRating } from "../review/reviewSession";

/**
 * Drei Karten zum Ausprobieren OHNE Konto (#609, Laras Entscheidung).
 *
 * Der Gast-Einstieg versprach „Ohne Konto starten", verlangte dann aber in
 * jedem Tab ein Konto. Statt den Einstieg zu streichen gibt es jetzt etwas,
 * das ohne Konto wirklich funktioniert.
 *
 * Alles hier ist reine Anschauung: Die Karten liegen fest im Code, es wird
 * nichts geladen, nichts gespeichert, es gibt keine Lernpunkte und keinen
 * Lernstand. Genau das sagt der Bildschirm auch — sonst wäre es dieselbe
 * unerfüllte Zusage wie vorher.
 *
 * Drei Fächer, damit man sofort sieht, wofür clearn gedacht ist.
 */
export interface DemoCard {
  front: string;
  back: string;
  subject: string;
}

export const DEMO_CARDS: readonly DemoCard[] = [
  {
    subject: "Biologie",
    front: "Was machen Mitochondrien?",
    back: "Sie sind die Kraftwerke der Zelle und stellen Energie her (ATP).",
  },
  {
    subject: "Geschichte",
    front: "In welchem Jahr begann der Erste Weltkrieg?",
    back: "1914",
  },
  {
    subject: "Englisch",
    front: "to become",
    back: "werden — became, become",
  },
] as const;

/**
 * Wie viele Karten als gewusst zählen. Nutzt bewusst `wasKnown` aus dem
 * echten Lernen, damit „Schwer" hier genauso als nicht gewusst zählt (#565)
 * — eine Demo, die anders rechnet als die App, wäre irreführend.
 */
export function countKnownDemoRatings(ratings: readonly ReviewRating[]): number {
  return ratings.filter(wasKnown).length;
}

/** Überschrift der Abschluss-Seite. */
export function demoResultTitle(known: number, total: number): string {
  if (total > 0 && known === total) return "Alles gewusst";
  if (known === 0) return "Noch nichts sicher";
  return "Fast geschafft";
}

/** Ergebnis-Satz der Abschluss-Seite. */
export function demoResultBody(known: number, total: number): string {
  const gezaehlt =
    total === 1 ? `1 Karte, davon ${known} gewusst` : `${total} Karten, davon ${known} gewusst`;
  return `${gezaehlt}. Zum Ausprobieren wird nichts davon gespeichert — mit einem Konto merkt sich clearn deinen Fortschritt und zeigt dir jede Karte genau dann wieder, wenn du sie brauchst.`;
}
