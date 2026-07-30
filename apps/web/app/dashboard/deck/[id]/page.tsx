"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { Modal } from "@/components/app/modal";
import { OcclusionShot } from "@/components/app/occlusion-shot";
import { getCardImages, occlusionTarget, type CardImage } from "@/lib/card-images";
import { cardListPreview } from "@/lib/card-display";
import { deckCountLabel } from "@/lib/deck-count-label";
import { adviceForLimit } from "@/lib/import-limits";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";
import { useRefreshOnFocus } from "@/lib/use-refresh-on-focus";
import {
  getDeckDetails,
  listCardsInDeck,
  createCard,
  updateCard,
  deleteCard,
  isApiError,
  type Card,
  type DeckDetails,
} from "@/lib/api";
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  Trash,
  Star,
  StarFilled,
  Layers,
  ListChecks,
  Match,
  FileText,
  ImageIcon,
  AlertTriangle,
} from "@/components/icons";

// Lern-Modi wie im App-Deck-Screen. „active" gibt es im Web schon; der Rest
// ist (noch) nur in der App und wird ausgegraut gezeigt.
type Mode = {
  key: string;
  title: string;
  sub: string;
  Icon: typeof Layers;
  color: string;
  path?: string; // Unterpfad relativ zum Deck, wenn im Web verfügbar
  min: number; // benötigte Textkarten, damit der Modus wirklich starten kann
};
const MODES: Mode[] = [
  { key: "flip", title: "Karteikarten", sub: "Klassisch umdrehen & bewerten", Icon: Layers, color: "#6366f1", path: "learn", min: 1 },
  { key: "mcq", title: "Multiple Choice", sub: "Antwort aus Optionen wählen", Icon: ListChecks, color: "#8b5cf6", path: "quiz", min: 2 },
  { key: "match", title: "Zuordnen", sub: "Begriffe & Definitionen paaren", Icon: Match, color: "#3b82f6", path: "match", min: 2 },
  { key: "cloze", title: "Lückentext", sub: "Fehlendes aktiv ergänzen", Icon: Pencil, color: "#d97706", path: "cloze", min: 1 },
  // min 2: unter zwei Karten findet buildTestQuestions keine falsche Antwort
  // (canChoose braucht 2 Antworten), es gäbe also nur Schreibfragen — und bei
  // „nur Multiple Choice" gar keine.
  { key: "test", title: "Test", sub: "Klausur mit Prozent-Ergebnis", Icon: FileText, color: "#dc2626", path: "test", min: 2 },
  // Occlusion wird separat als eigene Kachel gerendert (bedingt: aktiv nur mit Bild-Karten).
];

type CardModal =
  | { type: "add" }
  | { type: "edit"; card: Card }
  | { type: "delete"; card: Card }
  | { type: "view"; card: Card }
  | null;

export default function DeckDetailPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const { userId } = useAuth();
  const router = useRouter();
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/dashboard");
  };

  const [details, setDetails] = useState<DeckDetails | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<CardModal>(null);
  const [cardImages, setCardImages] = useState<Record<string, CardImage | null>>({});
  const fetchedPaths = useRef<Set<string>>(new Set());
  const coarsePointer = useCoarsePointer();

  const load = useCallback(async () => {
    if (!deckId) return;
    try {
      const [{ details: d }, { cards: c }] = await Promise.all([
        getDeckDetails(deckId),
        listCardsInDeck(deckId),
      ]);
      setDetails(d);
      setCards(c);
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Deck konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    load();
  }, [load]);

  // Nach dem Lernen am Handy zeigte die offene Deck-Seite am Laptop weiter den
  // alten Stand (#610) — auch Karten, die inzwischen woanders geändert wurden.
  useRefreshOnFocus(load);

  // Bilder nachladen, sobald die Karten da sind — die Liste soll darauf nicht
  // warten. Die Abhängigkeit ist die Menge der Pfade (dedupliziert, sortiert),
  // nicht `cards`: mehrere Karten teilen sich ein Bild, also darf weder ein
  // Stern-Klick noch das Löschen einer von zehn Karten neue signierte URLs
  // holen — ein geändertes href lädt das Bild sonst komplett neu.
  const occlusionPaths = Array.from(
    new Set(
      cards
        .filter((c) => c.type === "occlusion" && c.sourceImageUrl)
        .map((c) => c.sourceImageUrl as string)
    )
  )
    .sort()
    .join("|");

  useEffect(() => {
    if (!occlusionPaths) return;
    // Schon geholte Pfade nicht erneut signieren: kommt ein neues Bild dazu,
    // sollen die übrigen Vorschaubilder stehen bleiben.
    const missing = occlusionPaths.split("|").filter((p) => !fetchedPaths.current.has(p));
    if (missing.length === 0) return;
    let active = true;
    getCardImages(missing).then((loaded) => {
      if (!active) return;
      missing.forEach((p) => fetchedPaths.current.add(p));
      setCardImages((prev) => ({ ...prev, ...loaded }));
    });
    return () => {
      active = false;
    };
  }, [occlusionPaths]);

  async function toggleStar(card: Card) {
    setCards((prev) =>
      prev.map((c) => (c.id === card.id ? { ...c, starred: !c.starred } : c))
    );
    try {
      await updateCard(card.id, { starred: !card.starred });
    } catch {
      // revert on failure
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, starred: card.starred } : c))
      );
    }
  }

  if (loading) return <div className="spinner" />;

  if (error && !details) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <AlertTriangle size={30} />
        </div>
        <h3>Deck nicht gefunden</h3>
        <p>{error}</p>
        <Link href="/dashboard" className="btn btn-primary">
          Zur Bibliothek
        </Link>
      </div>
    );
  }

  // Bild-Occlusion-Karten sind ein eigener Typ: sie gehören nur in den
  // Occlusion-Modus, nicht in die normale Kartenliste oder die Textmodi.
  const textCards = cards.filter((c) => c.type !== "occlusion");
  const occlusionCards = cards.filter((c) => c.type === "occlusion");
  const hasOcclusion = occlusionCards.length > 0;

  // Dieselbe Regel wie Deck-Liste und Ordner-Seite (deck-count-label): Teile mit
  // null weglassen, leeres Deck → kein Label (der Leerzustand sagt es schon).
  const cardCountLabel = deckCountLabel(textCards.length, occlusionCards.length);

  // Wie viele andere Karten hängen am selben Bild? Gezählt werden KARTEN, nicht
  // Regionen: extraData.regions führt gelöschte Stellen weiter mit, die Zahl
  // wäre sonst zu hoch, sobald eine Karte fehlt.
  const siblingsOf = (card: Card | null) =>
    card?.type === "occlusion" && card.sourceImageUrl
      ? occlusionCards.filter(
          (c) => c.sourceImageUrl === card.sourceImageUrl && c.id !== card.id
        ).length
      : 0;

  const viewingCard = modal?.type === "view" ? modal.card : null;
  const viewImage = viewingCard?.sourceImageUrl ? cardImages[viewingCard.sourceImageUrl] : null;
  const viewTarget = viewingCard ? occlusionTarget(viewingCard) : null;
  const viewSiblings = siblingsOf(viewingCard);
  // Noch nicht geholt (Eintrag fehlt) ist etwas anderes als fehlgeschlagen
  // (Eintrag ist null) — sonst behaupten wir einen Fehler, der keiner ist.
  const viewLoading = Boolean(
    viewingCard?.sourceImageUrl && !(viewingCard.sourceImageUrl in cardImages)
  );

  // Für den Lösch-Dialog: das Bild der betroffenen Karte.
  const deletingCard = modal?.type === "delete" ? modal.card : null;
  const deleteImage =
    deletingCard?.type === "occlusion" && deletingCard.sourceImageUrl
      ? cardImages[deletingCard.sourceImageUrl]
      : null;
  const siblingCount = siblingsOf(deletingCard);

  return (
    <div className="deck-detail">
      <button
        type="button"
        onClick={goBack}
        className="crumb"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <ArrowLeft size={16} /> Zurück
      </button>

      <div className="detail-head">
        <div>
          {/* overflowWrap: ein Titel ohne Leerzeichen darf die Seite nicht
              horizontal aufschieben (#612). */}
          <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, overflowWrap: "anywhere" }}>
            {details?.title}
          </h1>
          {cardCountLabel && (
            <p className="muted" style={{ marginTop: 4 }}>
              {cardCountLabel}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModal({ type: "add" })}
        >
          + Karte
        </button>
      </div>

      {error && (
        <div className="form-error" role="alert" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {cards.length > 0 && (
        <>
          <h2 className="h3" style={{ marginBottom: 10 }}>
            Wie möchtest du lernen?
          </h2>
          <div className="mode-list">
            {/* Textmodi nur zeigen, wenn es Textkarten gibt; jeder Modus ist nur
                aktiv, wenn genug Karten da sind — sonst ausgegraut statt in einen
                Leerbildschirm zu führen. */}
            {textCards.length > 0 &&
              MODES.map((m) => {
                const enabled = textCards.length >= m.min;
                const inner = (
                  <>
                    <span
                      className="mode-card__ic"
                      style={
                        enabled
                          ? { background: `${m.color}22`, color: m.color }
                          : { background: "var(--bg-softer)", color: "var(--ink-3)" }
                      }
                      aria-hidden
                    >
                      <m.Icon size={20} />
                    </span>
                    <span className="mode-card__body">
                      <span className="mode-card__title">{m.title}</span>
                      <span className="mode-card__sub">
                        {enabled ? m.sub : `Braucht mindestens ${m.min} Karten`}
                      </span>
                    </span>
                    {enabled ? (
                      <ChevronRight size={20} className="mode-card__chevron" />
                    ) : (
                      <span className="mode-card__badge">zu wenige</span>
                    )}
                  </>
                );
                return enabled ? (
                  <Link
                    key={m.key}
                    href={`/dashboard/deck/${deckId}/${m.path}`}
                    className="mode-card"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={m.key} className="mode-card mode-card--soon" aria-disabled="true">
                    {inner}
                  </div>
                );
              })}
            {/* Occlusion-Kachel: aktiv (grün) → lernen, wenn das Deck Bild-Karten hat;
                sonst ausgegraut → Editor, um erst ein Bild hinzuzufügen. */}
            <Link
              href={`/dashboard/deck/${deckId}/${hasOcclusion ? "occlusion" : "occlusion/new"}`}
              className={`mode-card${hasOcclusion ? "" : " mode-card--soon"}`}
            >
              <span
                className="mode-card__ic"
                style={
                  hasOcclusion
                    ? { background: "#05966922", color: "#059669" }
                    : { background: "var(--bg-softer)", color: "var(--ink-3)" }
                }
                aria-hidden
              >
                <ImageIcon size={20} />
              </span>
              <span className="mode-card__body">
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="mode-card__title">Occlusion</span>
                  {/* Statisches Pro-Schild — sagt allen vorab „das ist Pro", statt
                      es erst beim Speichern zu verraten (#364). Bewusst OHNE
                      Tarif-Abfrage: so kann es niemanden fälschlich sperren und
                      kostet keine Anfrage bei jedem Deck-Öffnen.
                      Es ist ein Schild, keine Sperre: der Link führt weiter wie
                      bisher — Free-Nutzerinnen empfängt der Editor selbst mit dem
                      Vorab-Hinweis (#376), durchgesetzt wird serverseitig (#352).
                      Form: .mode-card__badge (das Schild dieser Zeile), Farbe wie
                      das KI-Abzeichen aus #369 — inline, weil diese Kachel ihre
                      Farben schon inline setzt (siehe .mode-card__ic darüber). */}
                  <span
                    className="mode-card__badge"
                    style={{ background: "rgba(99, 102, 241, 0.12)", color: "var(--brand)" }}
                  >
                    Pro
                  </span>
                </span>
                <span className="mode-card__sub">
                  {hasOcclusion
                    ? "Bildteile verdecken & abfragen"
                    : coarsePointer
                      ? "Noch kein Bild — zum Erstellen antippen"
                      : "Noch kein Bild — zum Erstellen klicken"}
                </span>
              </span>
              <ChevronRight size={20} className="mode-card__chevron" />
            </Link>
          </div>
        </>
      )}

      {cards.length === 0 ? (
        <div className="empty-state">
          <div className="ic" aria-hidden>
            <Layers size={30} />
          </div>
          <h3>Noch keine Karten</h3>
          <p>Füge deine erste Karte hinzu — Vorderseite ist die Frage, Rückseite die Antwort.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ type: "add" })}
          >
            + Erste Karte
          </button>
        </div>
      ) : (
        <>
          {textCards.length > 0 && (
          <>
          <h2 className="h3" style={{ margin: "0 0 10px" }}>
            Karten
          </h2>
          <div className="card-list">
            {textCards.map((card, i) => {
              // Aufbereitet wie in den Lernmodi (#612): Lücken als Strich statt
              // rohem {{c1::…}}, kein Bild-Markdown. Eine Seite ohne Text (reines
              // Bild ohne Unterschrift) sagt das, statt leer zu bleiben.
              const preview = cardListPreview(card);
              const emptySide = preview.hasImage ? "(Bild)" : "";
              return (
            <div key={card.id} className="card-row">
              <span className="card-row__num">{i + 1}</span>
              <div className="card-row__faces">
                <div className="card-row__front">{preview.front || emptySide}</div>
                <div className="card-row__back">{preview.back || emptySide}</div>
              </div>
              <div className="card-row__actions">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={card.starred ? "Markierung entfernen" : "Markieren"}
                  onClick={() => toggleStar(card)}
                  style={card.starred ? { color: "var(--amber)" } : undefined}
                >
                  {card.starred ? <StarFilled size={17} /> : <Star size={17} />}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Karte bearbeiten"
                  onClick={() => setModal({ type: "edit", card })}
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Karte löschen"
                  onClick={() => setModal({ type: "delete", card })}
                >
                  <Trash size={16} />
                </button>
              </div>
            </div>
              );
            })}
          </div>
          </>
          )}
          {occlusionCards.length > 0 && (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  margin: "16px 0 10px",
                }}
              >
                <h2 className="h3" style={{ margin: 0 }}>
                  Bild-Karten (Occlusion)
                </h2>
                <span className="muted" style={{ fontSize: "0.78rem" }}>
                  {coarsePointer ? "zum Vergrößern antippen" : "zum Vergrößern anklicken"}
                </span>
              </div>
              <div className="card-list">
                {occlusionCards.map((card, i) => {
                  const img = card.sourceImageUrl ? cardImages[card.sourceImageUrl] : null;
                  const label = card.back || card.front || `Bild-Karte ${i + 1}`;
                  return (
                    <div key={card.id} className="card-row card-row--img">
                      {/* Eigener Knopf statt Klick auf die ganze Zeile: so bleibt
                          der Papierkorb außerhalb der Trefferfläche (sonst löscht
                          ein Vergrößern-Tipp daneben) und Tastatur/Vorlesen
                          funktionieren ohne Nachbau. */}
                      <button
                        type="button"
                        className="card-row__tap"
                        aria-label={`${label} vergrößern`}
                        onClick={() => setModal({ type: "view", card })}
                      >
                        {/* Platzhalter und Bild sind gleich groß — die Zeile
                            springt beim Nachladen also nicht. */}
                        <span className="card-row__thumb" aria-hidden>
                          {img ? (
                            <OcclusionShot
                              img={img}
                              region={occlusionTarget(card)}
                              className="occ-shot"
                            />
                          ) : (
                            <ImageIcon size={18} />
                          )}
                        </span>
                        <span className="card-row__faces">
                          <span className="card-row__front">{label}</span>
                        </span>
                      </button>
                      <div className="card-row__actions">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Bild-Karte löschen"
                          onClick={() => setModal({ type: "delete", card })}
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {(modal?.type === "add" || modal?.type === "edit") && (
        <CardEditor
          initial={modal.type === "edit" ? modal.card : undefined}
          onClose={() => setModal(null)}
          onSubmit={async (front, back) => {
            if (modal.type === "edit") {
              await updateCard(modal.card.id, { front, back });
            } else {
              if (!userId) return;
              await createCard(userId, deckId, { front, back });
            }
            setModal(null);
            await load();
          }}
        />
      )}

      {modal?.type === "view" && (
        <Modal
          title={modal.card.back || "Bild-Karte"}
          onClose={() => setModal(null)}
        >
          {viewImage ? (
            <>
              <div className="delete-preview">
                <OcclusionShot
                  img={viewImage}
                  region={viewTarget}
                  className="occ-shot occ-shot--lg"
                />
              </div>
              {/* Der Satz darf nur behaupten, was auch gezeichnet wurde: ohne
                  Stelle zeichnet OcclusionShot nur das nackte Bild. */}
              {viewTarget ? (
                <p className="muted">Die gesuchte Stelle ist umrandet.</p>
              ) : (
                <p className="muted">Zu dieser Karte ist keine Stelle hinterlegt.</p>
              )}
              {viewSiblings > 0 && (
                <p className="muted">
                  {viewSiblings === 1
                    ? "Zu diesem Bild gehört noch eine weitere Karte."
                    : `Zu diesem Bild gehören noch ${viewSiblings} weitere Karten.`}
                </p>
              )}
            </>
          ) : viewLoading ? (
            <div className="spinner" />
          ) : (
            <>
              <p className="muted">Das Bild konnte nicht geladen werden.</p>
              {modal.card.back && <p className="muted">Gesuchte Stelle: {modal.card.back}</p>}
            </>
          )}
          <div className="modal__actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setModal({ type: "delete", card: modal.card })}
            >
              Löschen
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setModal(null)}>
              Schließen
            </button>
          </div>
        </Modal>
      )}

      {modal?.type === "delete" && (
        <Modal
          title={modal.card.type === "occlusion" ? "Bild-Karte löschen" : "Karte löschen"}
          onClose={() => setModal(null)}
        >
          {modal.card.type === "occlusion" ? (
            <>
              {deleteImage && (
                <div className="delete-preview">
                  <OcclusionShot
                    img={deleteImage}
                    region={occlusionTarget(modal.card)}
                    className="occ-shot occ-shot--lg"
                  />
                </div>
              )}
              <p>Soll diese Bild-Karte wirklich gelöscht werden?</p>
              {modal.card.back && (
                <p className="muted">Gesuchte Stelle: {modal.card.back}</p>
              )}
              {siblingCount > 0 && (
                <p className="muted">
                  Das Bild und die{" "}
                  {siblingCount === 1 ? "andere Karte" : `${siblingCount} anderen Karten`} dazu
                  bleiben erhalten.
                </p>
              )}
            </>
          ) : (
            <p className="muted">Soll diese Karte wirklich gelöscht werden?</p>
          )}
          <div className="modal__actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: "#dc2626", boxShadow: "none" }}
              onClick={async () => {
                const id = modal.card.id;
                setModal(null);
                setCards((prev) => prev.filter((c) => c.id !== id));
                try {
                  await deleteCard(id);
                } catch {
                  setError("Löschen fehlgeschlagen.");
                  await load();
                }
              }}
            >
              Löschen
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CardEditor({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: Card | undefined;
  onClose: () => void;
  onSubmit: (front: string, back: string) => Promise<void>;
}) {
  const [front, setFront] = useState(initial?.front ?? "");
  const [back, setBack] = useState(initial?.back ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Nachfrage vor dem Verwerfen (#608): Escape, Klick neben das Fenster und
  // „Abbrechen" werfen sonst halbfertigen Text kommentarlos weg.
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = front !== (initial?.front ?? "") || back !== (initial?.back ?? "");

  function requestClose() {
    // Während des Speicherns nicht schließen — sonst wüsste niemand, ob die
    // Karte angekommen ist.
    if (busy) return;
    if (confirmDiscard) {
      // Escape im Nachfrage-Fenster: zurück zum Bearbeiten, nichts verwerfen.
      setConfirmDiscard(false);
      return;
    }
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim()) {
      setError("Bitte Vorder- und Rückseite ausfüllen.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(front.trim(), back.trim());
    } catch (e) {
      // Am vollen Deck hilft kein zweiter Versuch — dann steht hier, wie viele
      // Karten der Tarif erlaubt und was der Ausweg ist (#611).
      setError(adviceForLimit(e) ?? "Speichern fehlgeschlagen. Bitte versuche es erneut.");
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "Karte bearbeiten" : "Neue Karte"} onClose={requestClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <div className="card-editor">
          <div className="field">
            <label htmlFor="front">Vorderseite (Frage)</label>
            <textarea
              id="front"
              className="textarea"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              disabled={busy}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="back">Rückseite (Antwort)</label>
            <textarea
              id="back"
              className="textarea"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>
        {error && (
          <div className="form-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}
        <div className="modal__actions">
          <button type="button" className="btn btn-ghost" onClick={requestClose} disabled={busy}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Bitte warten…" : initial ? "Speichern" : "Hinzufügen"}
          </button>
        </div>
      </form>
      {confirmDiscard && (
        // Liegt im DOM hinter dem Editor-Overlay und damit optisch darüber —
        // dieselben Modal-Bausteine, nur schmaler. Klick neben das Fenster
        // heißt hier „Weiter bearbeiten": Die zerstörende Wahl braucht einen
        // ausdrücklichen Knopfdruck.
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmDiscard(false);
          }}
        >
          <div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-label="Änderungen verwerfen?"
            style={{ maxWidth: 340 }}
          >
            <h3 className="h3">Änderungen verwerfen?</h3>
            <p className="muted" style={{ margin: 0 }}>
              Dein eingetippter Text geht sonst verloren.
            </p>
            <div className="modal__actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Verwerfen
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setConfirmDiscard(false)}
                autoFocus
              >
                Weiter bearbeiten
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
