"use client";

/**
 * Die Trefferquote, getrennt nach der Art der Antwort.
 *
 * Warum es das gibt: die eine Quote oben mischt zwei sehr verschiedene
 * Leistungen — eine Karte umdrehen und ehrlich „wusste ich nicht" tippen,
 * gegen die richtige von vier Kacheln treffen. Seit Multiple Choice und
 * Zuordnen mitzählen, hebt Raten die Gesamtzahl, ohne dass eine Karte aus dem
 * Kopf kam. Getrennt bleibt sichtbar, was wirklich saß.
 *
 * Eigene Komponente, damit die Vorschau beim Prüfen exakt dasselbe rendert wie
 * die Statistikseite — eine nachgebaute Kopie würde genau das Detail nicht
 * zeigen, das später bricht.
 */
export type AccuracyKind = { rate: number; answers: number };

export type AccuracyByKind = {
  recall: AccuracyKind;
  recognition: AccuracyKind;
};

/** Die Ampel der Statistikseite: unter 60 rot, unter 80 gelb, sonst grün.
 *  Von hier aus geteilt, damit die Balken hier und die Deck-Liste nie
 *  verschiedene Schwellen benutzen — zwei Ampeln, die bei 61 % anders
 *  entscheiden, liest niemand als Fehler, sondern als Willkür. */
export function accColor(rate: number): string {
  const pct = rate <= 1 ? rate * 100 : rate;
  if (pct < 60) return "#e2504a";
  if (pct < 80) return "#d97706";
  return "#16a34a";
}

// Die Lernmodi stehen im Klartext dabei: „Abruf" und „Wiedererkennen" sind die
// Fachwörter, aber die Namen der Modi sind das, was man angetippt hat.
//
// Die Beschriftungen sind bewusst gleich gebaut — „Aus dem Kopf" gegen „Aus den
// Antworten" —, weil dann nur der mittlere Teil den Unterschied trägt und man
// ihn nicht dazudenken muss. Zwei frühere Fassungen sind daran gescheitert und
// sollen nicht zurückkommen:
//   „Beim Aufwärmen getroffen" — Sport-Bild, das die App nirgends erklärt, und
//   es klingt, als wäre Multiple Choice kein richtiges Lernen. Dasselbe gilt für
//   jedes „getroffen": es klingt nach Glückstreffer statt nach Können.
//   „Aus der Auswahl erkannt" — „Auswahl" heißt in genau diesen beiden Modi
//   schon etwas anderes: „Für diese Auswahl sind mindestens 2 Karten nötig"
//   meint die vorgenommenen Karten, nicht die Antwortkacheln.
const ROWS = [
  {
    key: "recall" as const,
    label: "Aus dem Kopf gewusst",
    // „Üben" (der Wackelkandidaten-Knopf der App-Deck-Statistik, mode "practice")
    // zählt in dieser Quote mit, steht aber bewusst nicht dabei: als Kachel gibt
    // es den Modus nirgends, und im Web existiert er gar nicht (#498, Punkt 5).
    modes: "Karteikarten · Lückentext · Occlusion",
  },
  {
    key: "recognition" as const,
    // Plural, weil es auch fürs Zuordnen stimmen muss: dort liegen viele
    // Kacheln offen statt vier Antworten zu einer Frage.
    label: "Aus den Antworten erkannt",
    modes: "Multiple Choice · Zuordnen",
  },
];

export function AccuracyByKindPanel({ data }: { data: AccuracyByKind }) {
  // Nichts davon gemacht: dann sind zwei Striche keine Information, sondern
  // nur eine leere Karte mehr auf einer ohnehin vollen Seite.
  if (data.recall.answers === 0 && data.recognition.answers === 0) return null;

  return (
    <div className="panel">
      <div style={{ fontWeight: 600, marginBottom: 2 }}>Trefferquote genauer</div>
      <p className="muted" style={{ fontSize: "0.8rem", margin: "0 0 14px" }}>
        Die Zahl oben fasst beides zusammen. Getrennt siehst du, was du wirklich aus dem
        Kopf konntest.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {ROWS.map((row) => {
          const { rate, answers } = data[row.key];
          const has = answers > 0;
          const pct = Math.round(rate <= 1 ? rate * 100 : rate);
          return (
            <div key={row.key}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 10,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{row.label}</span>
                {/* Strich statt „0 %", solange die Gruppe leer ist: 0 % wäre eine
                    Behauptung über Antworten, die es nicht gibt. */}
                <b style={{ fontSize: "1.05rem", color: has ? accColor(rate) : undefined }}>
                  {has ? `${pct} %` : "—"}
                </b>
              </div>
              {/* Balken, damit sich die beiden Quoten ohne Rechnen vergleichen
                  lassen. Die graue Schiene muss sichtbar sein, sonst fehlt dem
                  farbigen Teil der Bezug: 52 % sähen aus wie ein Balken, der
                  einfach da aufhört, statt wie gut die Hälfte. `--line` ist die
                  Trennlinien-Farbe und hat in hell wie dunkel genug Kontrast
                  zum Untergrund (`--border` gibt es nicht — die Schiene war
                  dadurch unsichtbar). */}
              <div
                aria-hidden
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "var(--line)",
                  overflow: "hidden",
                }}
              >
                {has && (
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: accColor(rate),
                    }}
                  />
                )}
              </div>
              <div className="muted" style={{ fontSize: "0.75rem", marginTop: 6 }}>
                {row.modes}
                {" · "}
                {has
                  ? `${answers.toLocaleString("de-DE")} ${answers === 1 ? "Antwort" : "Antworten"}`
                  : "noch nicht gemacht"}
              </div>
            </div>
          );
        })}
      </div>

      <p className="muted" style={{ fontSize: "0.75rem", margin: "14px 0 0" }}>
        Prüfungen zählen hier nicht mit — die haben ihren eigenen Bereich.
      </p>
    </div>
  );
}
