"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import {
  listCardsInDeck,
  reviewCard,
  earnLp,
  isApiError,
  type Card,
} from "@/lib/api";
import { getSupabase } from "@/lib/supabase-browser";
import { ArrowLeft, X, Trophy, ImageIcon, AlertTriangle, Zap } from "@/components/icons";
import { useDisplayName } from "@/lib/use-display-name";
import {
  beginSessionAward,
  getSessionReviewedCount,
  isSessionEarnFinalized,
  type SessionAwardState,
} from "@/lib/learn-session-lp";

const BUCKET = "card-images";

type Region = { x: number; y: number; w: number; h: number; label: string };
type OccItem = {
  id: string;
  path: string;
  regions: Region[];
  hideIndex: number;
  label: string;
};

// Aus einer Karte eine Occlusion-Aufgabe machen — oder null, wenn die Daten
// nicht passen (z.B. normale Karte oder unvollständige extraData).
function parseOcc(card: Card): OccItem | null {
  if (card.type !== "occlusion" || !card.sourceImageUrl) return null;
  const ed = card.extraData as { regions?: unknown; hideIndex?: unknown } | undefined;
  const regions = Array.isArray(ed?.regions) ? (ed.regions as Region[]) : null;
  const hideIndex = typeof ed?.hideIndex === "number" ? ed.hideIndex : 0;
  const target = regions?.[hideIndex];
  if (!regions || regions.length === 0 || !target) return null;
  return {
    id: card.id,
    path: card.sourceImageUrl,
    regions,
    hideIndex,
    // card.back ist die editierbare Antwort (Karten-Editor) und hat Vorrang;
    // das in extraData eingefrorene Label ist nur der Rückfall.
    label: (card.back || target.label || "").trim() || "?",
  };
}

const boxStyle = (r: Region) => ({
  left: `${r.x * 100}%`,
  top: `${r.y * 100}%`,
  width: `${r.w * 100}%`,
  height: `${r.h * 100}%`,
});

export default function OcclusionLearnPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const router = useRouter();
  const { userId } = useAuth();
  const displayName = useDisplayName();

  const [items, setItems] = useState<OccItem[]>([]);
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<"setup" | "study">("setup");
  const [maskOthers, setMaskOthers] = useState(true);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  // Items, die der Nutzer mit „Nochmal" bewertet hat — für die Wiederholung.
  const [wrong, setWrong] = useState<OccItem[]>([]);
  const [earned, setEarned] = useState<number | null>(null);
  const [earnCapReached, setEarnCapReached] = useState(false);
  const awardStateRef = useRef<SessionAwardState>({ finalized: false, inFlight: null });
  const pendingReviewsRef = useRef<Promise<unknown>[]>([]);
  // Volle geladene Liste, damit „Alle nochmal" nach einer Teil-Runde wieder alles nimmt.
  const allItemsRef = useRef<OccItem[]>([]);

  const load = useCallback(async () => {
    if (!deckId) return;
    try {
      const { cards } = await listCardsInDeck(deckId);
      const occ = cards.map(parseOcc).filter((o): o is OccItem => o !== null);
      allItemsRef.current = occ;
      setItems(occ);
      if (occ.length > 0) {
        // Bild liegt privat im Bucket — pro Bild eine signierte URL holen.
        const supabase = getSupabase();
        const paths = Array.from(new Set(occ.map((o) => o.path)));
        const entries = await Promise.all(
          paths.map(async (p) => {
            const { data } = await supabase.storage.from(BUCKET).createSignedUrl(p, 3600);
            return [p, data?.signedUrl ?? null] as const;
          })
        );
        setUrls(Object.fromEntries(entries));
      }
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Karten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    load();
  }, [load]);

  const total = items.length;
  const current = items[index];
  const done = phase === "study" && index >= total;

  const awardSession = useCallback((count: number) => {
    const state = awardStateRef.current;
    return beginSessionAward(state, count, async () => {
      try {
        const maxAttempts = 3;
        const retryDelayMs = 250;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          if (attempt > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs));
          }

          const pendingReviews = pendingReviewsRef.current;
          pendingReviewsRef.current = [];
          await Promise.allSettled(pendingReviews);

          const res = await earnLp("session", count);
          setEarned(res.granted);
          setEarnCapReached(res.capReached);

          if (isSessionEarnFinalized(res, count)) {
            state.finalized = true;
            break;
          }
        }
      } catch {
        /* LP-Gutschrift ist best-effort */
      }
    });
  }, []);

  useEffect(() => {
    if (done) void awardSession(total);
  }, [done, total, awardSession]);

  // Browser-Zurück oder ein Link verlassen die Runde ohne quit() — nur dieses
  // Abbau-Aufräumen rechnet die bis dahin bewerteten Bereiche noch ab (gleiches
  // Muster wie das Quiz, App-Vorbild #566). pendingReviewsRef statt State:
  // jede Bewertung stößt genau einen Review an, und nach einer regulären
  // Abrechnung ist der Ref leer — dann tut das hier nichts.
  useEffect(() => {
    return () => {
      const reviewedCount = getSessionReviewedCount(0, pendingReviewsRef.current.length);
      void awardSession(reviewedCount);
    };
  }, [awardSession]);

  function rate(known: boolean) {
    const item = items[index];
    if (!item || !userId) return;
    if (known) setCorrect((n) => n + 1);
    else setWrong((w) => [...w, item]);
    const reviewPromise = reviewCard(userId, item.id, known ? "good" : "again", {
      mode: "occlusion",
    }).catch(() => {
      /* review sync best-effort; scheduling will catch up on next load */
    });
    pendingReviewsRef.current.push(reviewPromise);
    setRevealed(false);
    window.setTimeout(() => setIndex((i) => i + 1), 140);
  }

  async function restart() {
    await awardSession(total);
    awardStateRef.current = { finalized: false, inFlight: null };
    pendingReviewsRef.current = [];
    setEarned(null);
    setEarnCapReached(false);
    // Zurück auf die volle Liste, falls zuvor eine Teil-Runde lief.
    setItems(allItemsRef.current);
    setIndex(0);
    setRevealed(false);
    setCorrect(0);
    setWrong([]);
    setPhase("setup");
  }

  // Nur die „nicht gewussten" Items erneut lernen — maskOthers bleibt, direkt ins Lernen.
  async function restartWrong() {
    const subset = wrong;
    await awardSession(total);
    awardStateRef.current = { finalized: false, inFlight: null };
    pendingReviewsRef.current = [];
    setEarned(null);
    setEarnCapReached(false);
    setItems(subset);
    setIndex(0);
    setRevealed(false);
    setCorrect(0);
    setWrong([]);
    setPhase("study");
  }

  async function quit() {
    const reviewedCount = getSessionReviewedCount(index, pendingReviewsRef.current.length);
    await awardSession(reviewedCount);
    router.push(`/dashboard/deck/${deckId}`);
  }

  if (loading) return <div className="spinner" />;

  if (error) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <AlertTriangle size={30} />
        </div>
        <h3>Konnte nicht laden</h3>
        <p>{error}</p>
        <Link href={`/dashboard/deck/${deckId}`} className="btn btn-primary">
          Zurück zum Deck
        </Link>
      </div>
    );
  }

  // Noch keine Occlusion-Karten im Deck → zum Editor schicken.
  if (total === 0) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <ImageIcon size={30} />
        </div>
        <h3>Noch keine Occlusion-Karten</h3>
        <p>Lade zuerst ein Bild hoch und markiere die Bereiche, die du lernen möchtest.</p>
        <Link href={`/dashboard/deck/${deckId}/occlusion/new`} className="btn btn-primary">
          Occlusion-Karten erstellen
        </Link>
      </div>
    );
  }

  // ---------- Ergebnis ----------
  if (done) {
    return (
      <div className="study-wrap">
        <div className="study-done">
          <div className="big" aria-hidden style={{ color: "var(--amber)" }}>
            <Trophy size={56} />
          </div>
          <h2 className="h2">Runde geschafft{displayName ? `, ${displayName}` : ""}!</h2>
          <p className="lead">
            Du hast {total} {total === 1 ? "Bereich" : "Bereiche"} durchgegangen — {correct} davon
            sicher gewusst.
          </p>
          {earned !== null && earned > 0 && (
            <span className="lp-pill">
              <Zap size={15} /> +{earned} Lernpunkte
            </span>
          )}
          {earned === 0 && earnCapReached && (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              Heutiges Lernpunkte-Limit erreicht — morgen gibt es wieder welche.
            </p>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {wrong.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={() => void restartWrong()}>
                Nur die nicht gewussten ({wrong.length})
              </button>
            )}
            <button
              type="button"
              className={`btn ${wrong.length > 0 ? "btn-ghost" : "btn-primary"}`}
              onClick={() => void restart()}
            >
              Alle nochmal
            </button>
            <Link href={`/dashboard/deck/${deckId}`} className="btn btn-ghost">
              Zurück zum Deck
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Setup ----------
  if (phase === "setup") {
    return (
      <div className="study-wrap">
        <Link href={`/dashboard/deck/${deckId}`} className="crumb">
          <ArrowLeft size={16} /> Zurück zum Deck
        </Link>

        <div className="cl-intro">
          <span
            className="cl-intro__ic"
            aria-hidden
            style={{ background: "rgba(5,150,105,0.14)", color: "#059669" }}
          >
            <ImageIcon size={30} />
          </span>
          <h1 className="h2">Occlusion</h1>
          <p className="muted">
            {total} {total === 1 ? "Bereich" : "Bereiche"} — Bild ansehen, verdeckten Teil erraten,
            aufdecken
          </p>
        </div>

        <div className="cl-optcard">
          <div className="cl-row">
            <div>
              <div className="cl-row__t">Andere Bereiche mitverdecken</div>
              <div className="cl-row__s">
                {maskOthers
                  ? "Fairer: alle anderen Markierungen sind auch verdeckt"
                  : "Leichter: nur der gefragte Bereich ist verdeckt"}
              </div>
            </div>
            <button
              type="button"
              className={`cl-switch${maskOthers ? " on" : ""}`}
              role="switch"
              aria-checked={maskOthers}
              aria-label="Andere Bereiche mitverdecken"
              onClick={() => setMaskOthers((m) => !m)}
            >
              <i />
            </button>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          onClick={() => setPhase("study")}
        >
          Starten
        </button>

        <div className="center" style={{ marginTop: 12 }}>
          <Link
            href={`/dashboard/deck/${deckId}/occlusion/new`}
            className="btn btn-ghost"
          >
            <ImageIcon size={16} /> Weitere Occlusion-Karten erstellen
          </Link>
        </div>
      </div>
    );
  }

  // ---------- Lernen ----------
  const src = current ? urls[current.path] : null;

  return (
    <div className="study-wrap">
      <div className="study-top">
        <button
          type="button"
          className="crumb"
          style={{ margin: 0, background: "none", border: "none", cursor: "pointer" }}
          onClick={() => void quit()}
        >
          <X size={16} /> Beenden
        </button>
        <div className="progress">
          <i style={{ width: `${(index / total) * 100}%` }} />
        </div>
        <span className="muted" style={{ fontWeight: 700, fontSize: "0.9rem" }}>
          Karte {index + 1} von {total}
        </span>
      </div>

      {current && (
        <>
          <div className="occ-view">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="Occlusion-Bild" draggable={false} />
            ) : (
              <div className="occ-drop" style={{ border: "none" }}>
                <AlertTriangle size={26} />
                <p>Bild konnte nicht geladen werden.</p>
              </div>
            )}
            {src &&
              current.regions.map((r, j) => {
                if (j === current.hideIndex) {
                  return (
                    <div
                      key={j}
                      className={`occ-mask occ-mask--target${revealed ? " is-gone" : ""}`}
                      style={boxStyle(r)}
                      aria-hidden
                    >
                      ?
                    </div>
                  );
                }
                if (!maskOthers) return null;
                return (
                  <div
                    key={j}
                    className="occ-mask occ-mask--other"
                    style={boxStyle(r)}
                    aria-hidden
                  />
                );
              })}
          </div>

          <p className="occ-ask">Was ist an der markierten Stelle?</p>
          <p className="occ-answer">{revealed ? <b>{current.label}</b> : " "}</p>

          {revealed ? (
            <div className="rating-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <button
                type="button"
                className="rating rating--again"
                onClick={() => rate(false)}
              >
                Nochmal
              </button>
              <button
                type="button"
                className="rating rating--good"
                onClick={() => rate(true)}
              >
                Gewusst
              </button>
            </div>
          ) : (
            <div className="center">
              <button type="button" className="btn btn-primary" onClick={() => setRevealed(true)}>
                Aufdecken
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
