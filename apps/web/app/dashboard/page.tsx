"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { Modal } from "@/components/app/modal";
import {
  listDecks,
  createDeck,
  updateDeck,
  deleteDeck,
  duplicateDeck,
  shareDeck,
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  listDecksInFolder,
  addDeckToFolder,
  isApiError,
  type Deck,
  type Folder,
} from "@/lib/api";
import { descendantFolders, folderPath, joinTitles } from "@/lib/folders";
import {
  Search,
  Layers,
  Folder as FolderIcon,
  MoreHorizontal,
  Play,
  Pencil,
  Copy,
  Share,
  Trash,
  AlertTriangle,
  Sparkles,
} from "@/components/icons";

type TabKey = "decks" | "folders";

type ModalState =
  | { type: "create" }
  | { type: "rename"; deck: Deck }
  | { type: "delete"; deck: Deck }
  | { type: "share"; deck: Deck; url: string }
  | { type: "addToFolder"; deck: Deck }
  // forDeck: set when the dialog was opened from "Zu Ordner hinzufügen" with no
  // folders yet — the new folder then takes that deck straight away.
  | { type: "createFolder"; forDeck?: Deck }
  | { type: "renameFolder"; folder: Folder }
  | { type: "deleteFolder"; folder: Folder }
  | null;

export default function LibraryPage() {
  const { userId } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<TabKey>("decks");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const loadDecks = useCallback(async () => {
    if (!userId) return;
    try {
      const { decks: fetched } = await listDecks(userId);
      setDecks(fetched);
      setPageError(null);
    } catch (e) {
      setPageError(
        isApiError(e) ? e.message : "Decks konnten nicht geladen werden."
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadFolders = useCallback(async () => {
    if (!userId) return;
    try {
      const { folders: fetched } = await listFolders();
      setFolders(fetched);
      // The folder list carries no deck count, so ask per folder. Users have a
      // handful of folders; a failed count shows as "—" rather than breaking.
      const counts = await Promise.all(
        fetched.map(async (f) => {
          try {
            const { decks: inFolder } = await listDecksInFolder(f.id);
            return [f.id, inFolder.length] as const;
          } catch {
            return [f.id, -1] as const;
          }
        })
      );
      setFolderCounts(Object.fromEntries(counts));
    } catch {
      setPageError("Ordner konnten nicht geladen werden.");
    }
  }, [userId]);

  useEffect(() => {
    loadDecks();
    loadFolders();
  }, [loadDecks, loadFolders]);

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

  const filteredFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...folders].sort((a, b) => a.title.localeCompare(b.title, "de"));
    if (!q) return sorted;
    return sorted.filter((f) => f.title.toLowerCase().includes(q));
  }, [folders, query]);

  return (
    <>
      <div className="lib-head">
        <div>
          <h1>Meine Bibliothek</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {tab === "decks"
              ? `${decks.length} ${decks.length === 1 ? "Deck" : "Decks"}`
              : `${folders.length} ${folders.length === 1 ? "Ordner" : "Ordner"}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/dashboard/import" className="btn btn-ghost">
            <Sparkles size={16} /> Scan
          </Link>
          {tab === "decks" ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModal({ type: "create" })}
            >
              + Neues Deck
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModal({ type: "createFolder" })}
            >
              + Neuer Ordner
            </button>
          )}
        </div>
      </div>

      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Bibliothek">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "decks"}
            className={tab === "decks" ? "active" : undefined}
            onClick={() => setTab("decks")}
          >
            Decks
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "folders"}
            className={tab === "folders" ? "active" : undefined}
            onClick={() => setTab("folders")}
          >
            Ordner
          </button>
        </div>
        <div className="input-icon">
          <span aria-hidden>
            <Search size={16} />
          </span>
          <input
            className="input"
            placeholder={tab === "decks" ? "Decks durchsuchen…" : "Ordner durchsuchen…"}
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
      ) : tab === "folders" ? (
        filteredFolders.length === 0 ? (
          <FolderEmptyState
            hasFolders={folders.length > 0}
            onCreate={() => setModal({ type: "createFolder" })}
          />
        ) : (
          <div className="deck-grid">
            {filteredFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                path={folderPath(folder, folders)}
                count={folderCounts[folder.id]}
                menuOpen={openMenu === folder.id}
                onToggleMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpenMenu((cur) => (cur === folder.id ? null : folder.id));
                }}
                onRename={() => {
                  setOpenMenu(null);
                  setModal({ type: "renameFolder", folder });
                }}
                onDelete={() => {
                  setOpenMenu(null);
                  setModal({ type: "deleteFolder", folder });
                }}
              />
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <EmptyState hasDecks={decks.length > 0} onCreate={() => setModal({ type: "create" })} />
      ) : (
        <div className="deck-grid">
          {filtered.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
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
              onAddToFolder={() => {
                setOpenMenu(null);
                setModal({ type: "addToFolder", deck });
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

      {modal?.type === "createFolder" && (
        <CreateOrRenameModal
          title="Neuer Ordner"
          confirmLabel="Erstellen"
          label="Ordnername"
          placeholder="z. B. Schule"
          onClose={() => setModal(null)}
          onSubmit={async (value) => {
            if (!userId) return;
            const forDeck = modal.forDeck;
            const { folder } = await createFolder(userId, value);
            if (forDeck) await addDeckToFolder(folder.id, forDeck.id);
            // A fresh folder holds nothing but the deck we just put in it, so
            // both the folder and its count are already known here.
            setFolders((prev) => [...prev, folder]);
            setFolderCounts((prev) => ({ ...prev, [folder.id]: forDeck ? 1 : 0 }));
            setModal(null);
          }}
        />
      )}

      {modal?.type === "renameFolder" && (
        <CreateOrRenameModal
          title="Ordner umbenennen"
          confirmLabel="Speichern"
          label="Ordnername"
          initial={modal.folder.title}
          onClose={() => setModal(null)}
          onSubmit={async (value) => {
            const { folder } = await updateFolder(modal.folder.id, { title: value });
            // Renaming touches no deck count, so patch the one folder in place
            // instead of reloading the list plus a count request per folder —
            // that round trip left the old name on screen for a beat.
            setFolders((prev) => prev.map((f) => (f.id === folder.id ? folder : f)));
            setModal(null);
          }}
        />
      )}

      {modal?.type === "deleteFolder" && (
        <DeleteFolderModal
          folder={modal.folder}
          folders={folders}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            const id = modal.folder.id;
            // parent_id cascades in the database, so the subfolders the dialog
            // just named go too — drop the whole branch at once and only reload
            // if the server disagrees.
            const gone = new Set([id, ...descendantFolders(id, folders).map((f) => f.id)]);
            setModal(null);
            setFolders((prev) => prev.filter((f) => !gone.has(f.id)));
            try {
              await deleteFolder(id);
            } catch {
              setPageError("Ordner konnte nicht gelöscht werden.");
              await loadFolders();
            }
          }}
        />
      )}

      {modal?.type === "addToFolder" && (
        <AddToFolderModal
          deck={modal.deck}
          folders={folders}
          onClose={() => setModal(null)}
          onPick={async (folderId) => {
            await addDeckToFolder(folderId, modal.deck.id);
            setModal(null);
            // The picker also lists folders the deck is already in, and the
            // server upserts — so the new count isn't reliably +1. Ask this one
            // folder rather than reloading every folder's count.
            try {
              const { decks: inFolder } = await listDecksInFolder(folderId);
              setFolderCounts((prev) => ({ ...prev, [folderId]: inFolder.length }));
            } catch {
              setFolderCounts((prev) => ({ ...prev, [folderId]: -1 }));
            }
          }}
          onCreateFolder={() => setModal({ type: "createFolder", forDeck: modal.deck })}
        />
      )}
    </>
  );
}

function DeckCard({
  deck,
  menuOpen,
  onToggleMenu,
  onRename,
  onAddToFolder,
  onDuplicate,
  onShare,
  onDelete,
}: {
  deck: Deck;
  menuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onRename: () => void;
  onAddToFolder: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const count = deck.cardCount ?? 0;
  return (
    <div style={{ position: "relative" }}>
      <Link href={`/dashboard/deck/${deck.id}`} className="deck-card">
        <div className="deck-card__top">
          <span className="deck-card__badge" aria-hidden>
            <Layers size={18} />
          </span>
        </div>
        <div className="deck-card__title">{deck.title}</div>
        <div className="deck-card__meta">
          <span>
            {count} {count === 1 ? "Karte" : "Karten"}
          </span>
          {deck.tags.slice(0, 2).map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
      </Link>

      <div className="pop" style={{ position: "absolute", top: 12, right: 12 }}>
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
            <Link href={`/dashboard/deck/${deck.id}`} role="menuitem">
              <Play size={15} /> Lernen
            </Link>
            <button type="button" onClick={onRename}>
              <Pencil size={15} /> Umbenennen
            </button>
            <button type="button" onClick={onAddToFolder}>
              <FolderIcon size={15} /> Zu Ordner hinzufügen
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

function FolderCard({
  folder,
  path,
  count,
  menuOpen,
  onToggleMenu,
  onRename,
  onDelete,
}: {
  folder: Folder;
  path: string[];
  count: number | undefined;
  menuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <Link href={`/dashboard/folder/${folder.id}`} className="deck-card">
        <div className="deck-card__top">
          <span className="deck-card__badge" aria-hidden>
            <FolderIcon size={18} />
          </span>
        </div>
        {path.length > 0 && (
          <div
            className="muted"
            style={{ fontSize: "0.78rem", marginBottom: 2 }}
            title={`Liegt in ${path.join(" / ")}`}
          >
            {path.join(" / ")}
          </div>
        )}
        <div className="deck-card__title">{folder.title}</div>
        <div className="deck-card__meta">
          <span>
            {count === undefined
              ? "Wird geladen…"
              : count < 0
                ? "Anzahl unbekannt"
                : `${count} ${count === 1 ? "Deck" : "Decks"}`}
          </span>
        </div>
      </Link>

      <div className="pop" style={{ position: "absolute", top: 12, right: 12 }}>
        <button
          type="button"
          className="icon-btn"
          aria-label="Ordner-Optionen"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
        >
          <MoreHorizontal size={18} />
        </button>
        {menuOpen && (
          <div className="menu" role="menu" onClick={(e) => e.stopPropagation()}>
            <Link href={`/dashboard/folder/${folder.id}`} role="menuitem">
              <FolderIcon size={15} /> Öffnen
            </Link>
            <button type="button" onClick={onRename}>
              <Pencil size={15} /> Umbenennen
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

function FolderEmptyState({
  hasFolders,
  onCreate,
}: {
  hasFolders: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="ic" aria-hidden>
        <FolderIcon size={30} />
      </div>
      <h3>{hasFolders ? "Keine Treffer" : "Noch keine Ordner"}</h3>
      <p>
        {hasFolders
          ? "Für deine Suche gibt es keinen passenden Ordner."
          : "Sortiere deine Decks in Ordner — zum Beispiel einen pro Fach."}
      </p>
      {!hasFolders && (
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          + Neuer Ordner
        </button>
      )}
    </div>
  );
}

function DeleteFolderModal({
  folder,
  folders,
  onClose,
  onConfirm,
}: {
  folder: Folder;
  folders: Folder[];
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  // parent_id cascades in the database, so subfolders go with it. Name them —
  // the flat list gives no other clue that they belong together.
  const doomed = descendantFolders(folder.id, folders);
  return (
    <Modal title="Ordner löschen" onClose={onClose}>
      <p className="muted">
        Soll „{folder.title}" wirklich gelöscht werden?
        {doomed.length > 0 && (
          <>
            {" "}
            {joinTitles(doomed.map((f) => f.title))}{" "}
            {doomed.length === 1 ? "wird" : "werden"} mitgelöscht.
          </>
        )}{" "}
        Deine Decks und Karten bleiben erhalten.
      </p>
      <div className="modal__actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Abbrechen
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ background: "#dc2626", boxShadow: "none" }}
          onClick={onConfirm}
        >
          Löschen
        </button>
      </div>
    </Modal>
  );
}

function AddToFolderModal({
  deck,
  folders,
  onClose,
  onPick,
  onCreateFolder,
}: {
  deck: Deck;
  folders: Folder[];
  onClose: () => void;
  onPick: (folderId: string) => Promise<void>;
  onCreateFolder: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sorted = useMemo(
    () => [...folders].sort((a, b) => a.title.localeCompare(b.title, "de")),
    [folders]
  );

  return (
    <Modal title="Zu Ordner hinzufügen" onClose={onClose}>
      <p className="muted">In welchen Ordner soll „{deck.title}" gelegt werden?</p>
      {sorted.length === 0 ? (
        <>
          <p className="muted">
            Du hast noch keine Ordner. Leg einen an — „{deck.title}" kommt gleich hinein.
          </p>
          <button type="button" className="btn btn-primary" onClick={onCreateFolder}>
            + Neuer Ordner
          </button>
        </>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {sorted.map((f) => {
            const path = folderPath(f, folders);
            return (
              <button
                key={f.id}
                type="button"
                className="btn btn-ghost"
                style={{ justifyContent: "flex-start", textAlign: "left" }}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await onPick(f.id);
                  } catch {
                    setError("Das hat nicht geklappt. Bitte versuche es erneut.");
                    setBusy(false);
                  }
                }}
              >
                <FolderIcon size={16} />
                <span>
                  {path.length > 0 && (
                    <span className="muted" style={{ fontSize: "0.78rem" }}>
                      {path.join(" / ")} /{" "}
                    </span>
                  )}
                  {f.title}
                </span>
              </button>
            );
          })}
        </div>
      )}
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
      </div>
    </Modal>
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
  label = "Titel",
  placeholder = "z. B. Biologie · Zellorganellen",
  onClose,
  onSubmit,
}: {
  title: string;
  confirmLabel: string;
  initial?: string;
  label?: string;
  placeholder?: string;
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
          <label htmlFor="deck-title">{label}</label>
          <input
            id="deck-title"
            ref={inputRef}
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
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
          {copied ? "Kopiert" : "Kopieren"}
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
