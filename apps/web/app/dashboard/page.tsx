"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { Modal } from "@/components/app/modal";
import {
  listDecks,
  getDueCards,
  createDeck,
  updateDeck,
  deleteDeck,
  duplicateDeck,
  shareDeck,
  isApiError,
  type Deck,
} from "@/lib/api";
import {
  Search,
  Layers,
  MoreHorizontal,
  Play,
  Pencil,
  Copy,
  Share,
  Trash,
  AlertTriangle,
  Sparkles,
  ChevronRight,
} from "@/components/icons";

type ModalState =
  | { type: "create" }
  | { type: "rename"; deck: Deck }
  | { type: "delete"; deck: Deck }
  | { type: "share"; deck: Deck; url: string }
  | null;

export default function LibraryPage() {
  const { userId } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  // Fällige Karten je Deck („N fällig"-Pille wie in der App) — best effort:
  // ein Fehler beim Fällig-Abruf darf die Liste nicht kaputt machen.
  const [dueByDeck, setDueByDeck] = useState<Record<string, number>>({});

  const loadDecks = useCallback(async () => {
    if (!userId) return;
    try {
      const [{ decks: fetched }, due] = await Promise.all([
        listDecks(userId),
        getDueCards(userId).catch(() => ({ cards: [] })),
      ]);
      setDecks(fetched);
      const counts: Record<string, number> = {};
      for (const card of due.cards) {
        counts[card.deckId] = (counts[card.deckId] ?? 0) + 1;
      }
      setDueByDeck(counts);
      setPageError(null);
    } catch (e) {
      setPageError(
        isApiError(e) ? e.message : "Decks konnten nicht geladen werden."
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenu]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [decks, query]);

  return (
    <>
      <div className="lib-head">
        <div>
          <h1>Meine Bibliothek</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {decks.length} {decks.length === 1 ? "Deck" : "Decks"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/dashboard/import" className="btn btn-ghost">
            <Sparkles size={16} /> Scan
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModal({ type: "create" })}
          >
            + Neues Deck
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="input-icon">
          <span aria-hidden>
            <Search size={16} />
          </span>
          <input
            className="input"
            placeholder="Decks durchsuchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {pageError && (
        <div className="form-error" role="alert" style={{ marginBottom: 18 }}>
          <AlertTriangle size={16} />
          <span>{pageError}</span>
        </div>
      )}

      {loading ? (
        <div className="spinner" />
      ) : filtered.length === 0 ? (
        <EmptyState hasDecks={decks.length > 0} onCreate={() => setModal({ type: "create" })} />
      ) : (
        <div className="deck-list">
          {filtered.map((deck) => (
            <DeckRow
              key={deck.id}
              deck={deck}
              dueCount={dueByDeck[deck.id] ?? 0}
              menuOpen={openMenu === deck.id}
              onToggleMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpenMenu((cur) => (cur === deck.id ? null : deck.id));
              }}
              onRename={() => {
                setOpenMenu(null);
                setModal({ type: "rename", deck });
              }}
              onDuplicate={async () => {
                setOpenMenu(null);
                try {
                  await duplicateDeck(deck.id);
                  await loadDecks();
                } catch {
                  setPageError("Duplizieren fehlgeschlagen.");
                }
              }}
              onShare={async () => {
                setOpenMenu(null);
                try {
                  const { shareUrl } = await shareDeck(deck.id);
                  setModal({ type: "share", deck, url: shareUrl });
                } catch {
                  setPageError("Teilen fehlgeschlagen.");
                }
              }}
              onDelete={() => {
                setOpenMenu(null);
                setModal({ type: "delete", deck });
              }}
            />
          ))}
        </div>
      )}

      {modal?.type === "create" && (
        <CreateOrRenameModal
          title="Neues Deck"
          confirmLabel="Erstellen"
          onClose={() => setModal(null)}
          onSubmit={async (value) => {
            if (!userId) return;
            await createDeck(userId, value);
            setModal(null);
            await loadDecks();
          }}
        />
      )}

      {modal?.type === "rename" && (
        <CreateOrRenameModal
          title="Deck umbenennen"
          confirmLabel="Speichern"
          initial={modal.deck.title}
          onClose={() => setModal(null)}
          onSubmit={async (value) => {
            await updateDeck(modal.deck.id, { title: value });
            setModal(null);
            await loadDecks();
          }}
        />
      )}

      {modal?.type === "delete" && (
        <Modal title="Deck löschen" onClose={() => setModal(null)}>
          <p className="muted">
            Soll „{modal.deck.title}" mit allen Karten wirklich gelöscht werden? Das lässt sich
            nicht rückgängig machen.
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
                const id = modal.deck.id;
                setModal(null);
                setDecks((prev) => prev.filter((d) => d.id !== id));
                try {
                  await deleteDeck(id);
                } catch {
                  setPageError("Löschen fehlgeschlagen.");
                  await loadDecks();
                }
              }}
            >
              Löschen
            </button>
          </div>
        </Modal>
      )}

      {modal?.type === "share" && (
        <ShareModal url={modal.url} title={modal.deck.title} onClose={() => setModal(null)} />
      )}
    </>
  );
}

function DeckRow({
  deck,
  dueCount,
  menuOpen,
  onToggleMenu,
  onRename,
  onDuplicate,
  onShare,
  onDelete,
}: {
  deck: Deck;
  dueCount: number;
  menuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onRename: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const count = deck.cardCount ?? 0;
  return (
    <div className="deck-row-wrap">
      <Link href={`/dashboard/deck/${deck.id}`} className="deck-row">
        <span className="deck-row__badge" aria-hidden>
          <Layers size={18} />
        </span>
        <span className="deck-row__body">
          <span className="deck-row__title">{deck.title}</span>
          <span className="deck-row__meta">
            <span>
              {count} {count === 1 ? "Karte" : "Karten"}
            </span>
            {dueCount > 0 && <span className="deck-row__due">{dueCount} fällig</span>}
            {deck.tags.slice(0, 2).map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </span>
        </span>
      </Link>

      <span className="deck-row__chevron" aria-hidden>
        <ChevronRight size={18} />
      </span>

      <div className="pop deck-row__actions">
        <button
          type="button"
          className="icon-btn"
          aria-label="Deck-Optionen"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
        >
          <MoreHorizontal size={18} />
        </button>
        {menuOpen && (
          <div className="menu" role="menu" onClick={(e) => e.stopPropagation()}>
            <Link href={`/dashboard/deck/${deck.id}/learn`} role="menuitem">
              <Play size={15} /> Lernen
            </Link>
            <button type="button" onClick={onRename}>
              <Pencil size={15} /> Umbenennen
            </button>
            <button type="button" onClick={onDuplicate}>
              <Copy size={15} /> Duplizieren
            </button>
            <button type="button" onClick={onShare}>
              <Share size={15} /> Teilen
            </button>
            <button type="button" className="danger" onClick={onDelete}>
              <Trash size={15} /> Löschen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  hasDecks,
  onCreate,
}: {
  hasDecks: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="ic" aria-hidden>
        <Layers size={30} />
      </div>
      <h3>{hasDecks ? "Keine Treffer" : "Noch keine Decks"}</h3>
      <p>
        {hasDecks
          ? "Für deine Suche gibt es kein passendes Deck."
          : "Lass die KI aus Text oder einer Webseite fertige Karten erstellen — oder leg ein leeres Deck an."}
      </p>
      {!hasDecks && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/dashboard/import" className="btn btn-primary">
            <Sparkles size={16} /> Scan
          </Link>
          <button type="button" className="btn btn-ghost" onClick={onCreate}>
            + Leeres Deck anlegen
          </button>
        </div>
      )}
    </div>
  );
}

function CreateOrRenameModal({
  title,
  confirmLabel,
  initial = "",
  onClose,
  onSubmit,
}: {
  title: string;
  confirmLabel: string;
  initial?: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) {
      setError("Bitte gib einen Titel ein.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(value.trim());
    } catch {
      setError("Das hat nicht geklappt. Bitte versuche es erneut.");
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <div className="field">
          <label htmlFor="deck-title">Titel</label>
          <input
            id="deck-title"
            ref={inputRef}
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="z. B. Biologie · Zellorganellen"
            disabled={busy}
            maxLength={120}
          />
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
            {busy ? "Bitte warten…" : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ShareModal({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal title="Deck teilen" onClose={onClose}>
      <p className="muted">
        Jeder mit diesem Link kann „{title}" ansehen und als eigene Kopie übernehmen.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            } catch {
              /* clipboard unavailable — user can still copy manually */
            }
          }}
        >
          {copied ? "Kopiert ✓" : "Kopieren"}
        </button>
      </div>
      <div className="modal__actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Schließen
        </button>
      </div>
    </Modal>
  );
}
