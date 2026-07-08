"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import {
  scanText,
  importFromUrl,
  getLpBalance,
  listDecks,
  isApiError,
  type AiUsageResponse,
  type Deck,
} from "@/lib/api";
import {
  ArrowLeft,
  ChevronRight,
  TextType,
  Link as LinkIcon,
  Sparkles,
  Zap,
  AlertTriangle,
} from "@/components/icons";

// Ablauf wie im Scan-Bildschirm der App: erst die Quelle wählen ("choose"),
// dann die Eingabe für diese Quelle. Foto & PDF kommen in Runde 2 dazu.
type Mode = "choose" | "text" | "url";

const MAX_TEXT = 20000;

export default function ImportPage() {
  const { userId } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("choose");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<AiUsageResponse | null>(null);

  useEffect(() => {
    let active = true;
    getLpBalance()
      .then((u) => {
        if (active) setUsage(u);
      })
      .catch(() => {
        /* LP-Anzeige ist optional — der Server prüft ohnehin */
      });
    return () => {
      active = false;
    };
  }, []);

  const cost = usage
    ? mode === "url"
      ? usage.lpCostUrlImport
      : usage.lpCostAiScan
    : null;
  const enoughLp = usage && cost !== null ? usage.lpBalance >= cost : true;
  // Für den Hinweis im Auswahl-Menü: reicht es nicht mal für den günstigsten Import?
  const lowLp = usage ? usage.lpBalance < usage.lpCostAiScan : false;

  const findNewDeck = useCallback(
    async (beforeIds: Set<string>): Promise<Deck | null> => {
      if (!userId) return null;
      const { decks } = await listDecks(userId);
      const created = decks.find((d) => !beforeIds.has(d.id));
      if (created) return created;
      // Fallback: neuestes Deck (falls die ID-Erkennung mal nicht greift)
      return [...decks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    },
    [userId]
  );

  function choose(next: "text" | "url") {
    setError(null);
    setMode(next);
  }

  async function handleSubmit() {
    setError(null);
    if (mode === "text" && text.trim().length < 1) {
      setError("Bitte füge zuerst etwas Text ein.");
      return;
    }
    if (mode === "url" && !/^https?:\/\/.+/i.test(url.trim())) {
      setError("Bitte gib eine gültige URL ein (mit https:// davor).");
      return;
    }
    if (!userId) return;

    setBusy(true);
    try {
      const before = await listDecks(userId);
      const beforeIds = new Set(before.decks.map((d) => d.id));

      if (mode === "text") {
        await scanText(userId, text.trim());
      } else {
        await importFromUrl(userId, url.trim());
      }

      const created = await findNewDeck(beforeIds);
      router.push(created ? `/dashboard/deck/${created.id}` : "/dashboard");
      // absichtlich kein setBusy(false): die Seite navigiert weg
    } catch (e) {
      if (isApiError(e) && e.status === 402) {
        setError(
          "Dafür reichen deine Lernpunkte nicht. Neue Lernpunkte bekommst du durchs Lernen — Aufladen und Pro gibt es in der clearn-App."
        );
      } else {
        setError(isApiError(e) ? e.message : "Das hat nicht geklappt. Bitte versuch es erneut.");
      }
      setBusy(false);
    }
  }

  return (
    <>
      <Link href="/dashboard" className="crumb">
        <ArrowLeft size={16} /> Bibliothek
      </Link>

      <div className="lib-head">
        <div>
          <h1>Karten per KI erstellen</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Aus Text oder einer Webseite macht die KI in Sekunden fertige Lernkarten.
          </p>
        </div>
        {usage && (
          <span className={lowLp ? "lp-pill is-low" : "lp-pill"}>
            <Zap size={15} /> {usage.lpBalance.toLocaleString("de-DE")} LP
          </span>
        )}
      </div>

      <div className="import-view">
        {mode === "choose" ? (
          <>
            {usage && lowLp && (
              <div className="lp-warn" role="status">
                <Zap size={16} />
                <span>
                  Du hast {usage.lpBalance} LP. Ein KI-Import kostet ab {usage.lpCostAiScan} LP.
                  Neue Lernpunkte bekommst du durchs Lernen.
                </span>
              </div>
            )}

            <div className="source-grid">
              <button
                type="button"
                className="source-card source-card--text"
                onClick={() => choose("text")}
              >
                <span className="source-card__ic">
                  <TextType size={22} />
                </span>
                <span className="source-card__body">
                  <span className="source-card__title">Text eingeben</span>
                  <span className="source-card__hint">Zusammenfassung, Notizen, Definitionen</span>
                </span>
                {usage && (
                  <span className="source-card__cost">
                    <Zap size={12} /> {usage.lpCostAiScan} LP
                  </span>
                )}
                <ChevronRight size={20} className="source-card__chevron" />
              </button>

              <button
                type="button"
                className="source-card source-card--url"
                onClick={() => choose("url")}
              >
                <span className="source-card__ic">
                  <LinkIcon size={22} />
                </span>
                <span className="source-card__body">
                  <span className="source-card__title">URL importieren</span>
                  <span className="source-card__hint">Webseite als Lernkarten</span>
                </span>
                {usage && (
                  <span className="source-card__cost">
                    <Zap size={12} /> {usage.lpCostUrlImport} LP
                  </span>
                )}
                <ChevronRight size={20} className="source-card__chevron" />
              </button>
            </div>

            <div className="info-note">
              <Sparkles size={16} />
              <span>
                Die KI liest dein Material und macht daraus automatisch Frage-Antwort-Karten — aus
                Text oder einer Webseite.
              </span>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="back-link"
              onClick={() => {
                setMode("choose");
                setError(null);
              }}
              disabled={busy}
            >
              <ArrowLeft size={16} /> Andere Quelle wählen
            </button>

            {mode === "text" ? (
              <div className="field">
                <label htmlFor="import-text">Dein Lernstoff als Text</label>
                <textarea
                  id="import-text"
                  className="textarea"
                  style={{ minHeight: 220 }}
                  value={text}
                  maxLength={MAX_TEXT}
                  onChange={(e) => setText(e.target.value)}
                  disabled={busy}
                  placeholder="Füge hier deinen Text ein — z. B. eine Zusammenfassung, Notizen oder Definitionen. Die KI macht daraus Frage-Antwort-Karten."
                />
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  {text.length.toLocaleString("de-DE")} / {MAX_TEXT.toLocaleString("de-DE")} Zeichen
                </span>
              </div>
            ) : (
              <div className="field">
                <label htmlFor="import-url">Webseiten-Adresse (URL)</label>
                <input
                  id="import-url"
                  className="input"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={busy}
                  placeholder="https://de.wikipedia.org/wiki/Mitochondrium"
                />
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  Die KI liest den Inhalt der Seite und macht Karten daraus.
                </span>
              </div>
            )}

            {usage && !enoughLp && !error && (
              <div className="lp-warn" role="status" style={{ marginTop: 14, marginBottom: 0 }}>
                <Zap size={16} />
                <span>
                  Dafür reichen deine Lernpunkte nicht ({usage.lpBalance} von {cost}). Neue
                  Lernpunkte bekommst du durchs Lernen.
                </span>
              </div>
            )}

            {error && (
              <div className="form-error" role="alert" style={{ marginTop: 14 }}>
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              style={{ marginTop: 20 }}
              onClick={handleSubmit}
              disabled={busy || (usage ? !enoughLp : false)}
            >
              {busy ? (
                "KI erstellt deine Karten…"
              ) : (
                <>
                  <Sparkles size={18} /> Karten erstellen
                  {cost !== null && (
                    <span className="btn-cost">
                      <Zap size={13} /> {cost}
                    </span>
                  )}
                </>
              )}
            </button>

            {busy && (
              <p className="muted center" style={{ marginTop: 14 }}>
                Das kann ein paar Sekunden dauern — die KI liest dein Material und formt Karten.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
