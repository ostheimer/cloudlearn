"use client";

/**
 * Der Prüfungs-Bereich der Statistik — sitzt direkt unter „Trefferquote
 * genauer".
 *
 * Warum getrennt von den anderen Zahlen: eine Prüfung misst unter Druck, ohne
 * Umdrehen und ohne Selbstbewertung. Ihre Quote gehört deshalb nicht in die
 * Lern-Trefferquote (die lässt Prüfungen seit #483 aus), sondern hierher, wo
 * sie ehrlich neben der selbst vergebenen steht.
 */
import { ListChecks } from "@/components/icons";
import { accColor } from "./accuracy-by-kind";
import type { TestAttemptSummary } from "@/lib/api";
import {
  examPercentOverShown,
  percent,
  ratePercent,
  relativeDay,
  showsGapNote,
  TEST_ATTEMPTS_SHOWN,
} from "@/lib/test-attempts-view";

export function TestAttemptsPanel({
  attempts,
  selfGradedRate,
}: {
  attempts: TestAttemptSummary[];
  /** „Aus dem Kopf gewusst"-Quote (0..1), die selbst vergebene Zahl. null, wenn
   *  es davon noch keine gibt — dann entfällt der Vergleich. */
  selfGradedRate: number | null;
}) {
  // Noch keine Prüfung: ein ehrlicher Leerzustand statt einer leeren Karte.
  if (attempts.length === 0) {
    return (
      <div className="panel">
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Prüfungen</div>
        <div style={{ textAlign: "center", padding: "10px 4px" }}>
          <div
            aria-hidden
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--bg-soft)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 10,
              color: "var(--ink-3)",
            }}
          >
            <ListChecks size={20} />
          </div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Noch keine Prüfung gemacht</div>
          <p className="muted" style={{ fontSize: "0.85rem", margin: 0, lineHeight: 1.6 }}>
            Eine Prüfung misst ehrlicher als das Lernen mit Umdrehen — dort bewertest du
            selbst, ob du es wusstest. Mach eine Prüfung, dann siehst du hier, wie du
            wirklich abschneidest.
          </p>
        </div>
      </div>
    );
  }

  const shown = attempts.slice(0, TEST_ATTEMPTS_SHOWN);
  const examPct = examPercentOverShown(shown);
  const selfPct = ratePercent(selfGradedRate);
  const gapNote = showsGapNote(examPct, selfPct);

  return (
    <div className="panel">
      <div style={{ fontWeight: 600, marginBottom: 12 }}>Prüfungen</div>

      {/* Vergleich: die gemessene Zahl betont, die selbst vergebene blass daneben. */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, background: "var(--bg-soft)", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 500, color: accColor(examPct) }}>{examPct} %</div>
          <div className="muted" style={{ fontSize: "0.75rem" }}>in Prüfungen</div>
        </div>
        {selfPct != null && (
          <div
            style={{
              flex: 1,
              background: "var(--bg-soft)",
              borderRadius: 10,
              padding: "10px 12px",
              opacity: 0.6,
            }}
          >
            <div style={{ fontSize: "1.4rem", fontWeight: 500 }}>{selfPct} %</div>
            <div className="muted" style={{ fontSize: "0.75rem" }}>selbst bewertet</div>
          </div>
        )}
      </div>

      {/* Ein Satz, der den Abstand einordnet — bewusst RUHIG (weiche Fläche,
          kein Alarmgelb), weil eine Prüfung schlechter auszufallen normal ist
          und nicht wie ein Fehler aussehen soll. Nur wenn die Prüfung wirklich
          tiefer liegt; steht sie gleich oder höher, wäre der Satz falsch. */}
      {gapNote && (
        <p
          className="muted"
          style={{
            fontSize: "0.8rem",
            lineHeight: 1.55,
            margin: "0 0 14px",
            background: "var(--bg-soft)",
            borderRadius: 8,
            padding: "9px 11px",
          }}
        >
          In einer Prüfung schneidest du meist etwas schlechter ab als beim Lernen mit
          Umdrehen — das ist normal und ehrlicher.
        </p>
      )}

      <div className="muted" style={{ fontSize: "0.75rem", margin: gapNote ? "0 0 8px" : "2px 0 8px" }}>
        {shown.length === 1 ? "Deine letzte Prüfung" : `Deine letzten ${shown.length} Prüfungen`}
      </div>

      <div>
        {shown.map((attempt, index) => {
          const pct = percent(attempt.correctCount, attempt.questionCount);
          return (
            <div
              key={attempt.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "9px 0",
                borderBottom: index < shown.length - 1 ? "0.5px solid var(--line)" : "none",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.9rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {attempt.deckTitle || "Ohne Deck"}
                </div>
                <div className="muted" style={{ fontSize: "0.75rem" }}>{relativeDay(attempt.submittedAt)}</div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <div style={{ fontSize: "0.9rem", fontWeight: 500, color: accColor(pct) }}>{pct} %</div>
                <div className="muted" style={{ fontSize: "0.75rem" }}>
                  {attempt.correctCount} von {attempt.questionCount}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
