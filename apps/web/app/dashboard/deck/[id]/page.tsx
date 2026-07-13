"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { Modal } from "@/components/app/modal";
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
};
const MODES: Mode[] = [
  { key: "flip", title: "Karteikarten", sub: "Klassisch umdrehen & bewerten", Icon: Layers, color: "#6366f1", path: "learn" },
  { key: "mcq", title: "Multiple Choice", sub: "Antwort aus Optionen wählen", Icon: ListChecks, color: "#8b5cf6", path: "quiz" },
  { key: "match", title: "Zuordnen", sub: "Begriffe & Definitionen paaren", Icon: Match, color: "#3b82f6", path: "match" },
  { key: "cloze", title: "Lückentext", sub: "Fehlendes aktiv ergänzen", Icon: Pencil, color: "#d97706", path: "cloze" },
  { key: "test", title: "Test", sub: "Klausur mit Prozent-Ergebnis", Icon: FileText, color: "#dc2626", path: "test" },
  { key: "occ", title: "Occlusion", sub: "Bildteile verdecken & abfragen", Icon: ImageIcon, color: "#059669" },
];

type CardModal =
  | { type: "add" }
  | { type: "edit"; card: Card }
  | { type: "delete"; card: Card }
  | null;

export default function DeckDetailPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const { userId } = useAuth();

  const [details, setDetails] = useState<DeckDetails | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<CardModal>(null);

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

  return (
    <div className="deck-detail">
      <Link href="/dashboard" className="crumb">
        <ArrowLeft size={16} /> Bibliothek
      </Link>

      <div className="detail-head">
        <div>
          <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800 }}>
            {details?.title}
          </h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {cards.length} {cards.length === 1 ? "Karte" : "Karten"}
          </p>
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
            {MODES.map((m) => {
              const inner = (
                <>
                  <span
                    className="mode-card__ic"
                    style={{ background: `${m.color}22`, color: m.color }}
                    aria-hidden
                  >
                    <m.Icon size={20} />
                  </span>
                  <span className="mode-card__body">
                    <span className="mode-card__title">{m.title}</span>
                    <span className="mode-card__sub">{m.sub}</span>
                  </span>
                  {m.path ? (
                    <ChevronRight size={20} className="mode-card__chevron" />
                  ) : (
                    <span className="mode-card__badge">in der App</span>
                  )}
                </>
              );
              return m.path ? (
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
          <h2 className="h3" style={{ margin: "0 0 10px" }}>
            Karten
          </h2>
          <div className="card-list">
            {cards.map((card, i) => (
            <div key={card.id} className="card-row">
              <span className="card-row__num">{i + 1}</span>
              <div className="card-row__faces">
                <div className="card-row__front">{card.front}</div>
                <div className="card-row__back">{card.back}</div>
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
          ))}
          </div>
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

      {modal?.type === "delete" && (
        <Modal title="Karte löschen" onClose={() => setModal(null)}>
          <p className="muted">Soll diese Karte wirklich gelöscht werden?</p>
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim()) {
      setError("Bitte Vorder- und Rückseite ausfüllen.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(front.trim(), back.trim());
    } catch {
      setError("Speichern fehlgeschlagen. Bitte versuche es erneut.");
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "Karte bearbeiten" : "Neue Karte"} onClose={onClose}>
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
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Bitte warten…" : initial ? "Speichern" : "Hinzufügen"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
