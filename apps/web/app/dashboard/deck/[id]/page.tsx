"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { Modal } from "@/components/app/modal";
import { CardEditor } from "@/components/app/card-editor";
import { OcclusionShot } from "@/components/app/occlusion-shot";
import { getCardImages, occlusionTarget, type CardImage } from "@/lib/card-images";
import { cardDeleteQuestion, cardListPreview } from "@/lib/card-display";
import { deckCountLabel } from "@/lib/deck-count-label";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";
import { useRefreshOnFocus } from "@/lib/use-refresh-on-focus";
import {
  getDeckDetails,
  listCardsInDeck,
  createCard,
  updateCard,
  updateDeck,
  deleteCard,
  deleteCards,
  isApiError,
  type Card,
  type DeckDetails,
} from "@/lib/api";
import { loadPlanLimits } from "@/lib/plan-limits";
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
  Search,
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
  // Mehrfachauswahl (#614): löscht die angekreuzten Karten in EINEM Zug.
  | { type: "deleteMany"; ids: string[] }
  | { type: "view"; card: Card }
  // Deck-Details samt Schlagwort-Bearbeitung (#571 Teil B) — beides konnte
  // bisher nur die App.
  | { type: "details" }
  | null;

export default function DeckDetailPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const { userId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Sprung aus der Bibliothek-Suche (?card=<id>, #610): die Zeile kurz
  // hervorheben und dorthin scrollen, statt nur auf der Deck-Wurzel zu landen.
  const highlightCardId = searchParams.get("card");
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const cardRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Suchfeld über der Kartenliste (#610) — rein clientseitig, die Karten sind
  // schon geladen.
  const [cardQuery, setCardQuery] = useState("");
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
  // Mehrfachauswahl der Kartenliste (#614). Laras Entscheidung: nur Löschen —
  // „Verschieben" fiel mit dem Karten-Verschieben weg, das sie abgelehnt hat.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fetchedPaths = useRef<Set<string>>(new Set());
  const coarsePointer = useCoarsePointer();
  // Kartengrenze für den Füllstand im Kopf (#611). Über loadPlanLimits, das den
  // Wert je Sitzung EINMAL holt — die Deck-Seite wird oft geöffnet, und ein
  // Abruf bei jedem Öffnen war der Einwand von #376. `undefined` heißt
  // „unbekannt": dann bleibt die nackte Kartenzahl und nichts wird gesperrt.
  const [maxCardsPerDeck, setMaxCardsPerDeck] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void loadPlanLimits().then((limits) => {
      if (active) setMaxCardsPerDeck(limits.maxCardsPerDeck);
    });
    return () => {
      active = false;
    };
  }, [userId]);

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

  // Aus der Bibliothek-Suche zur Karte springen (#610): scrollen, kurz
  // hervorheben, danach wieder normal — nur einmal je Aufruf, damit ein
  // späteres Neuladen (Fokus-Nachladen) das Hervorheben nicht wiederholt.
  const jumpedRef = useRef(false);
  const highlightTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (!highlightCardId || jumpedRef.current || cards.length === 0) return;
    const row = cardRowRefs.current[highlightCardId];
    if (!row) return;
    jumpedRef.current = true;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedRowId(highlightCardId);
    highlightTimeoutRef.current = window.setTimeout(() => setHighlightedRowId(null), 2200);
    // Kein Cleanup hier, das den Timeout abbricht: das Fokus-Nachladen ersetzt
    // `cards` (neue Array-Referenz), das würde diesen Effect erneut auslösen
    // und den bereits laufenden Timeout canceln, ohne ihn neu zu setzen —
    // der Hervorheb-Zustand bliebe für immer an. Nur beim echten Unmount räumen.
  }, [highlightCardId, cards]);
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

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

  /**
   * Auswahl-Modus verlassen und die Häkchen wegwerfen. Nach jedem Löschen und
   * bei „Abbrechen" — eine stehen gebliebene Auswahl auf einer neu geladenen
   * Liste zeigt auf Karten, die es nicht mehr gibt.
   */
  const leaveSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds([]);
  }, []);

  const toggleSelected = useCallback((cardId: string) => {
    setSelectedIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  }, []);

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
  // Ist die Tarif-Grenze bekannt, steht hier der Füllstand statt der nackten
  // Anzahl: „142 von 150 Karten" (#611).
  const cardCountLabel = deckCountLabel(
    textCards.length,
    occlusionCards.length,
    maxCardsPerDeck
  );
  const deckIsFull =
    typeof maxCardsPerDeck === "number" &&
    textCards.length + occlusionCards.length >= maxCardsPerDeck;

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
            <p
              className="muted"
              style={{
                marginTop: 4,
                // Am vollen Deck warnfarben — die Zahl IST die Nachricht (#611).
                ...(deckIsFull ? { color: "var(--amber)" } : {}),
              }}
            >
              {deckIsFull ? `${cardCountLabel} — voll` : cardCountLabel}
            </p>
          )}
          {/* Details wie in der App (#571 Teil B): Anlegedatum, letzte Änderung,
              Schlagwörter und Ordner standen im Web nirgends — der Server
              liefert sie längst mit. */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: 8, padding: "4px 10px", fontSize: "0.85rem" }}
            onClick={() => setModal({ type: "details" })}
          >
            Details
          </button>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModal({ type: "add" })}
          // Nichts anbieten, was der Server sicher ablehnt (#611): Am vollen Deck
          // führte „+ Karte" bisher durch den ganzen Editor bis in eine
          // Fehlermeldung. Der Grund steht als Füllstand direkt daneben.
          disabled={deckIsFull}
          title={deckIsFull ? "Dieses Deck ist voll" : undefined}
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
              margin: "0 0 10px",
            }}
          >
            <h2 className="h3" style={{ margin: 0 }}>
              {selectMode
                ? `${selectedIds.length} ausgewählt`
                : `Karten (${textCards.length})`}
            </h2>
            {/* Erst ab zwei Karten: bei einer einzigen ist der Papierkorb in
                ihrer Zeile der kürzere Weg. */}
            {textCards.length > 1 && (
              <button
                type="button"
                className="card-select-toggle"
                onClick={() => {
                  if (selectMode) {
                    leaveSelectMode();
                  } else {
                    // Ein aktiver Suchfilter bliebe sonst unsichtbar aktiv —
                    // das Suchfeld verschwindet im Auswahl-Modus (s.o.).
                    setCardQuery("");
                    setSelectMode(true);
                  }
                }}
              >
                {selectMode ? "Abbrechen" : "Auswählen"}
              </button>
            )}
          </div>
          {/* Suche bleibt im Auswahl-Modus weg (#610 + #614) — sonst müsste
              Filtern und Ankreuzen gleichzeitig gedacht werden. */}
          {!selectMode && textCards.length > 4 && (
            <div className="input-icon" style={{ marginBottom: 12 }}>
              <span aria-hidden>
                <Search size={16} />
              </span>
              <input
                className="input"
                placeholder="Karten durchsuchen…"
                aria-label="Karten durchsuchen"
                value={cardQuery}
                onChange={(e) => setCardQuery(e.target.value)}
              />
            </div>
          )}
          <div className="card-list">
            {(() => {
              const term = cardQuery.trim().toLowerCase();
              const visible = term
                ? textCards.filter((card) => {
                    const preview = cardListPreview(card);
                    return (
                      preview.front.toLowerCase().includes(term) ||
                      preview.back.toLowerCase().includes(term)
                    );
                  })
                : textCards;
              if (visible.length === 0) {
                return <p className="muted">Keine Karten gefunden.</p>;
              }
              return visible.map((card) => {
              const i = textCards.indexOf(card);
              // Aufbereitet wie in den Lernmodi (#612): Lücken als Strich statt
              // rohem {{c1::…}}, kein Bild-Markdown. Eine Seite ohne Text (reines
              // Bild ohne Unterschrift) sagt das, statt leer zu bleiben.
              const preview = cardListPreview(card);
              const emptySide = preview.hasImage ? "(Bild)" : "";
              const picked = selectedIds.includes(card.id);
              return (
            <div
              key={card.id}
              ref={(el) => {
                cardRowRefs.current[card.id] = el;
              }}
              className={`card-row${selectMode ? " card-row--select" : ""}${
                picked ? " is-picked" : ""
              }${highlightedRowId === card.id ? " card-row--highlight" : ""}`}
              // Im Auswahl-Modus zählt die ganze Zeile als Trefferfläche, nicht
              // nur das Kästchen — am Handy ist ein 18px-Kästchen zu klein.
              // Klicks AUS dem Kästchen laufen über sein onChange, sonst würde
              // ein Treffer doppelt zählen und sich selbst aufheben.
              onClick={
                selectMode
                  ? (e) => {
                      if ((e.target as HTMLElement).closest("input")) return;
                      toggleSelected(card.id);
                    }
                  : undefined
              }
            >
              {selectMode ? (
                <input
                  type="checkbox"
                  className="card-row__check"
                  checked={picked}
                  onChange={() => toggleSelected(card.id)}
                  aria-label={`Auswählen: ${preview.front || emptySide || `Karte ${i + 1}`}`}
                />
              ) : (
                <span className="card-row__num">{i + 1}</span>
              )}
              <div className="card-row__faces">
                <div className="card-row__front">{preview.front || emptySide}</div>
                <div className="card-row__back">{preview.back || emptySide}</div>
              </div>
              {/* Stern, Stift und Papierkorb bleiben im Auswahl-Modus weg: sie
                  liegen in derselben Zeile, die jetzt auswählt, und ein
                  Fehlgriff hätte gelöscht statt angekreuzt. */}
              {!selectMode && (
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
              )}
            </div>
              );
            });
            })()}
          </div>
          {selectMode && (
            <div className="card-select-bar">
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: "#dc2626", boxShadow: "none" }}
                disabled={selectedIds.length === 0}
                onClick={() => setModal({ type: "deleteMany", ids: selectedIds })}
              >
                <Trash size={16} />{" "}
                {selectedIds.length === 0
                  ? "Löschen"
                  : `${selectedIds.length} löschen`}
              </button>
            </div>
          )}
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
          onSubmit={async (front, back, difficulty) => {
            if (modal.type === "edit") {
              await updateCard(modal.card.id, { front, back, difficulty });
            } else {
              if (!userId) return;
              await createCard(userId, deckId, { front, back, difficulty });
            }
            setModal(null);
            await load();
          }}
        />
      )}

      {modal?.type === "details" && details && (
        <DeckDetailsModal
          details={details}
          textCount={textCards.length}
          imageCount={occlusionCards.length}
          onClose={() => setModal(null)}
          onSaveTags={async (tags) => {
            const { deck } = await updateDeck(deckId, { tags });
            // Nur die Etiketten übernehmen — ein volles Neuladen würde die
            // Kartenliste umsonst neu holen.
            setDetails((prev) => (prev ? { ...prev, tags: deck.tags ?? tags } : prev));
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
              <p>{cardDeleteQuestion(modal.card)}</p>
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
            <p className="muted">{cardDeleteQuestion(modal.card)}</p>
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

      {modal?.type === "deleteMany" && (
        <Modal title="Karten löschen" onClose={() => setModal(null)}>
          {/* Auch bei vielen Karten wird gefragt — dieselbe Regel wie bei einer
              einzelnen, und die Zahl ist hier der wichtigste Teil der Frage. */}
          <p className="muted">
            {modal.ids.length === 1
              ? "Soll die ausgewählte Karte wirklich gelöscht werden?"
              : `Sollen ${modal.ids.length} ausgewählte Karten wirklich gelöscht werden?`}{" "}
            Sie landen im Papierkorb und lassen sich von dort zurückholen.
          </p>
          <div className="modal__actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: "#dc2626", boxShadow: "none" }}
              onClick={async () => {
                const ids = modal.ids;
                setModal(null);
                leaveSelectMode();
                // Erst aus der Liste nehmen, dann senden: das Löschen soll sich
                // sofort anfühlen. Geht es schief, holt `load()` die Wahrheit
                // zurück — genauso wie beim Löschen einer einzelnen Karte.
                setCards((prev) => prev.filter((c) => !ids.includes(c.id)));
                try {
                  await deleteCards(deckId, ids);
                } catch (e) {
                  setError(isApiError(e) ? e.message : "Löschen fehlgeschlagen.");
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


/**
 * Deck-Details (#571 Teil B) — das Web-Gegenstück zu `DeckDetailsModal` in der
 * App. Zeigt, was der Server bei `/details` ohnehin liefert und im Browser nie
 * ankam: Anlegedatum, letzte Änderung, Ordner-Zugehörigkeit.
 *
 * Die Schlagwörter sind hier zugleich BEARBEITBAR (der zweite offene Punkt):
 * In der App gehen sie über „Deck bearbeiten", im Web ließen sie sich gar nicht
 * ändern — eine beim Scannen vergebene Marke blieb für immer stehen.
 */
function DeckDetailsModal({
  details,
  textCount,
  imageCount,
  onClose,
  onSaveTags,
}: {
  details: DeckDetails;
  textCount: number;
  imageCount: number;
  onClose: () => void;
  onSaveTags: (tags: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  // Komma-getrennt wie im Deck-Bearbeiten-Fenster der App — kein Chip-Editor,
  // der auf dem Handy mehr Ärger macht als er löst.
  const [draft, setDraft] = useState(details.tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // „7. Juli 2026" — die Uhrzeit sagt hier nichts.
  const day = (iso: string | undefined) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
  };

  const rows: { label: string; value: string }[] = [
    {
      label: "Karten",
      value: imageCount > 0 ? `${textCount} · ${imageCount} Bild-Karten` : `${textCount}`,
    },
  ];
  const created = day(details.createdAt);
  const updated = day(details.updatedAt);
  if (created) rows.push({ label: "Erstellt am", value: created });
  if (updated) rows.push({ label: "Zuletzt geändert", value: updated });
  rows.push({
    label: "Ordner",
    value:
      details.folders && details.folders.length > 0
        ? details.folders.map((f) => f.title).join(", ")
        : "Keinem Ordner zugeordnet",
  });

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      // Leere Einträge und Dubletten fallen weg — sonst entsteht aus „a,,a"
      // eine Liste mit einem leeren und einem doppelten Schlagwort.
      const tags = [
        ...new Set(
          draft
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        ),
      ];
      await onSaveTags(tags);
      setEditing(false);
    } catch {
      setErr("Speichern fehlgeschlagen. Bitte versuche es erneut.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Details" onClose={onClose}>
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span className="muted">{r.label}</span>
            <span style={{ fontWeight: 600, textAlign: "right", minWidth: 0, overflowWrap: "anywhere" }}>
              {r.value}
            </span>
          </div>
        ))}

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span className="muted">Schlagwörter</span>
            {!editing && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "2px 10px", fontSize: "0.85rem" }}
                onClick={() => {
                  setDraft(details.tags.join(", "));
                  setEditing(true);
                }}
              >
                Ändern
              </button>
            )}
          </div>
          {editing ? (
            <>
              <input
                className="input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="z. B. Biologie, Zellen"
                disabled={busy}
                autoFocus
              />
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                Mehrere mit Komma trennen. Leer lassen entfernt alle.
              </span>
              {err && <p className="form-error">{err}</p>}
              <div className="modal__actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setEditing(false)}
                  disabled={busy}
                >
                  Abbrechen
                </button>
                <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
                  {busy ? "Bitte warten…" : "Speichern"}
                </button>
              </div>
            </>
          ) : (
            <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>
              {details.tags.length > 0 ? details.tags.join(", ") : "Keine Schlagwörter"}
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}
