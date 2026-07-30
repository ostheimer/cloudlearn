"use client";

/**
 * Papierkorb (#614, Laras Etappe 1).
 *
 * Bis hierher war Löschen der einzige unheilbare Schaden im Produkt. Technisch
 * lag nie etwas wirklich weg — jede gelöschte Zeile trug bloß einen Stempel —
 * es fehlte allein der Weg zurück.
 *
 * Laras Entscheidungen, die man an dieser Seite ablesen kann:
 *  - Nichts verschwindet von allein: kein Ablaufdatum, kein Aufräum-Job. Wer
 *    endgültig löschen will, drückt es selbst.
 *  - Auch Altbestand ist sichtbar. Beim Start liegen hier sofort die Decks, die
 *    vor Wochen gelöscht wurden — Verstecken wäre genau die Sorte Beschönigung,
 *    die sie an anderen Stellen abgelehnt hat.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  emptyTrash,
  getTrash,
  isApiError,
  purgeTrashCard,
  purgeTrashDeck,
  restoreTrashCard,
  restoreTrashDeck,
  type TrashCard,
  type TrashDeck,
} from "@/lib/api";
import { AlertTriangle, ArrowLeft, RotateCw, Trash } from "@/components/icons";
import { Modal } from "@/components/app/modal";

/** „gelöscht am 7. Juli" — kurz und ohne Uhrzeit, die hilft hier niemandem. */
function formatDeletedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", { day: "numeric", month: "long" });
}

function cardLabel(count: number): string {
  return count === 1 ? "1 Karte" : `${count} Karten`;
}

type Pending =
  | { kind: "purgeDeck"; deck: TrashDeck }
  | { kind: "purgeCard"; card: TrashCard }
  | { kind: "empty" };

export default function TrashPage() {
  const router = useRouter();
  const [decks, setDecks] = useState<TrashDeck[]>([]);
  const [cards, setCards] = useState<TrashCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Welche Zeile arbeitet gerade — sperrt genau ihre Knöpfe, nicht die Seite.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const trash = await getTrash();
      setDecks(trash.decks);
      setCards(trash.cards);
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Papierkorb konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/dashboard/profile");
  };

  /**
   * Ein Restore kann berechtigt scheitern — Deck-Grenze erreicht, Deck voll,
   * oder das Deck der Karte liegt selbst im Papierkorb. Der Server schickt in
   * allen drei Fällen einen fertigen deutschen Satz (#611); der wird gezeigt,
   * statt ihn durch ein allgemeines „hat nicht funktioniert" zu ersetzen.
   */
  const runRestore = async (id: string, action: () => Promise<unknown>, label: string) => {
    setBusyId(id);
    setNotice(null);
    try {
      await action();
      setNotice(`${label} ist wieder da.`);
      await load();
    } catch (e) {
      setError(isApiError(e) ? e.message : "Zurückholen hat nicht funktioniert.");
    } finally {
      setBusyId(null);
    }
  };

  const runPurge = async (id: string, action: () => Promise<unknown>, label: string) => {
    setBusyId(id);
    setNotice(null);
    try {
      await action();
      setNotice(`${label} ist endgültig gelöscht.`);
      await load();
    } catch (e) {
      setError(isApiError(e) ? e.message : "Endgültiges Löschen hat nicht funktioniert.");
    } finally {
      setBusyId(null);
    }
  };

  const total = decks.length + cards.length;

  if (loading && total === 0 && !error) return <div className="spinner" />;

  return (
    <>
      <div className="lib-head">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <button
            type="button"
            onClick={goBack}
            aria-label="Zurück"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-2)",
              display: "inline-flex",
            }}
          >
            <ArrowLeft size={22} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1>Papierkorb</h1>
            <p className="muted" style={{ marginTop: 4 }}>
              Hier liegt alles, was du gelöscht hast — bis du es selbst endgültig entfernst.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="panel" style={{ borderColor: "#dc2626", marginBottom: 14 }}>
          <p style={{ margin: 0, color: "#dc2626", display: "flex", gap: 8 }}>
            <AlertTriangle size={18} /> {error}
          </p>
        </div>
      )}

      {notice && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <p className="muted" style={{ margin: 0 }}>
            {notice}
          </p>
        </div>
      )}

      {total === 0 ? (
        <div className="empty-state">
          <h3>Der Papierkorb ist leer</h3>
          <p>
            Gelöschte Decks und Karten landen hier und lassen sich zurückholen. Nichts verschwindet
            von allein.
          </p>
          <Link href="/dashboard" className="btn btn-primary">
            Zur Bibliothek
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 18 }}>
          {decks.length > 0 && (
            <section>
              <h2 className="h3" style={{ marginBottom: 10 }}>
                Decks · {decks.length}
              </h2>
              {/* minmax(0, 1fr): lange Deck-Titel melden trotz Kürzung ihre volle
                  Breite und blähen am Handy sonst die ganze Seite auf (#545). */}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
                {decks.map((deck) => (
                  <div key={deck.id} className="panel" style={{ padding: "12px 14px" }}>
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: 600,
                      }}
                      title={deck.title}
                    >
                      {deck.title}
                    </div>
                    <p className="muted" style={{ margin: "2px 0 10px", fontSize: "0.85rem" }}>
                      {cardLabel(deck.cardCount)} · gelöscht am {formatDeletedAt(deck.deletedAt)}
                    </p>
                    <div className="trash-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === deck.id}
                        onClick={() =>
                          runRestore(
                            deck.id,
                            () => restoreTrashDeck(deck.id),
                            `„${deck.title}"`
                          )
                        }
                      >
                        <RotateCw size={16} /> Zurückholen
                      </button>
                      <button
                        type="button"
                        className="trash-purge"
                        disabled={busyId === deck.id}
                        onClick={() => setPending({ kind: "purgeDeck", deck })}
                      >
                        <Trash size={16} /> Endgültig löschen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {cards.length > 0 && (
            <section>
              <h2 className="h3" style={{ marginBottom: 10 }}>
                Einzelne Karten · {cards.length}
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
                {cards.map((card) => (
                  <div key={card.id} className="panel" style={{ padding: "12px 14px" }}>
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontWeight: 600,
                      }}
                      title={card.front}
                    >
                      {card.front}
                    </div>
                    <p className="muted" style={{ margin: "2px 0 10px", fontSize: "0.85rem" }}>
                      aus „{card.deckTitle}" · gelöscht am {formatDeletedAt(card.deletedAt)}
                    </p>
                    <div className="trash-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === card.id}
                        onClick={() =>
                          runRestore(card.id, () => restoreTrashCard(card.id), "Die Karte")
                        }
                      >
                        <RotateCw size={16} /> Zurückholen
                      </button>
                      <button
                        type="button"
                        className="trash-purge"
                        disabled={busyId === card.id}
                        onClick={() => setPending({ kind: "purgeCard", card })}
                      >
                        <Trash size={16} /> Endgültig löschen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <button
            type="button"
            className="btn btn-ghost"
            style={{ color: "#dc2626", justifySelf: "center" }}
            disabled={busyId !== null}
            onClick={() => setPending({ kind: "empty" })}
          >
            Papierkorb leeren
          </button>
        </div>
      )}

      {pending?.kind === "purgeDeck" && (
        <Modal title="Deck endgültig löschen" onClose={() => setPending(null)}>
          <p className="muted">
            „{pending.deck.title}" und {cardLabel(pending.deck.cardCount)} werden wirklich
            gelöscht. Danach gibt es kein Zurück mehr — auch deine Antworten zu diesen Karten
            verschwinden aus der Statistik.
          </p>
          <div className="modal__actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: "#dc2626", boxShadow: "none" }}
              onClick={() => {
                const deck = pending.deck;
                setPending(null);
                void runPurge(deck.id, () => purgeTrashDeck(deck.id), `„${deck.title}"`);
              }}
            >
              Endgültig löschen
            </button>
          </div>
        </Modal>
      )}

      {pending?.kind === "purgeCard" && (
        <Modal title="Karte endgültig löschen" onClose={() => setPending(null)}>
          <p className="muted">
            Diese Karte wird wirklich gelöscht. Danach gibt es kein Zurück mehr — auch deine
            Antworten zu ihr verschwinden aus der Statistik.
          </p>
          <div className="modal__actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: "#dc2626", boxShadow: "none" }}
              onClick={() => {
                const card = pending.card;
                setPending(null);
                void runPurge(card.id, () => purgeTrashCard(card.id), "Die Karte");
              }}
            >
              Endgültig löschen
            </button>
          </div>
        </Modal>
      )}

      {pending?.kind === "empty" && (
        <Modal title="Papierkorb leeren" onClose={() => setPending(null)}>
          <p className="muted">
            Alles im Papierkorb wird wirklich gelöscht: {decks.length === 1 ? "1 Deck" : `${decks.length} Decks`}{" "}
            und {cardLabel(cards.length)}. Danach gibt es kein Zurück mehr — auch deine Antworten
            zu diesen Karten verschwinden aus der Statistik.
          </p>
          <div className="modal__actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: "#dc2626", boxShadow: "none" }}
              onClick={() => {
                setPending(null);
                void runPurge("__all__", () => emptyTrash(), "Der Papierkorb");
              }}
            >
              Alles endgültig löschen
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
