"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { useRefreshOnFocus } from "@/lib/use-refresh-on-focus";
import { Modal } from "@/components/app/modal";
import {
  listDecks,
  createDeck,
  updateDeck,
  deleteDeck,
  duplicateDeck,
  shareDeck,
  revokeDeckShare,
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  listDecksInFolder,
  addDeckToFolder,
  getDueCountsByDeck,
  searchCards,
  isApiError,
  type Deck,
  type Folder,
  type CardSearchResult,
} from "@/lib/api";
import { adviceForLimit } from "@/lib/import-limits";
import { descendantFolders, folderPath } from "@/lib/folders";
import { FolderCard, DeleteFolderModal } from "@/components/app/folder-ui";
import { deckCountLabel } from "@/lib/deck-count-label";
import {
  SPEECH_LANGUAGES,
  toSpeechLanguage,
  type SpeechLanguage,
} from "@/lib/speech-languages";
import {
  Search,
  Layers,
  Folder as FolderIcon,
  MoreHorizontal,
  Play,
  Pencil,
  Volume2,
  Copy,
  Share,
  Trash,
  AlertTriangle,
  Sparkles,
  ScanLine,
  Link as LinkIcon,
  RefreshSync,
  CheckCircle,
  ArrowsSort,
} from "@/components/icons";
import {
  DEFAULT_FOLDER_SORT,
  loadFolderSort,
  saveFolderSort,
  sortFolders,
  type FolderSort,
} from "@/lib/folder-sort";

type TabKey = "decks" | "folders";

// Ab dieser Listenlänge zeigen Auswahl-Fenster (Ordner-/Deck-Picker) ein
// Suchfeld (#612) — darunter wäre es nur Rauschen. Gleicher Wert im
// Ordner-Deck-Picker und in den App-Pickern (FolderPickerModal/DeckPickerModal).
const PICKER_SEARCH_THRESHOLD = 6;

// Interne Etiketten, die die API beim KI-Import ans Deck hängt — in der
// Datenbank bleiben sie erhalten (Suche/App nutzen sie), angezeigt werden sie nicht.
const TECH_TAGS = new Set(["scan", "auto", "auto-generated"]);

type ModalState =
  | { type: "create" }
  | { type: "rename"; deck: Deck }
  | { type: "speech"; deck: Deck }
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
  // Fällige Karten je Deck ("N fällig"-Abzeichen, wie in der App).
  const [dueByDeck, setDueByDeck] = useState<Record<string, number>>({});
  // Karten-Treffer der Suche: Die Suche im Suchfeld findet nicht nur Deck-Titel,
  // sondern ab zwei Zeichen auch Karten mit dem Wort in Frage oder Antwort —
  // genau wie der Deck-Tab der App.
  const [cardHits, setCardHits] = useState<CardSearchResult[]>([]);
  const [cardsSearching, setCardsSearching] = useState(false);
  // Ordner-Reihenfolge (#612): A–Z oder neueste zuerst, Wahl bleibt gemerkt.
  // Erst nach dem Mount aus dem Speicher lesen — beim Serverrendern gibt es
  // kein localStorage, und ein Unterschied zwischen Server- und Browser-Lauf
  // würde React als Hydrierungsfehler melden.
  const [folderSort, setFolderSort] = useState<FolderSort>(DEFAULT_FOLDER_SORT);
  useEffect(() => {
    setFolderSort(loadFolderSort());
  }, []);

  const loadDecks = useCallback(async () => {
    if (!userId) return;
    try {
      // Das Abzeichen ist best-effort: eine scheiternde Fällig-Abfrage darf
      // die Bibliothek nicht brechen (gleiche Logik wie im App-Deck-Tab).
      // Gezählt wird auf dem Server (#612): getDueCards überträgt den ganzen
      // Rückstand mit Kartentext und wird ab 1000 Karten still gekappt.
      const [{ decks: fetched }, { dueByDeck: due }] = await Promise.all([
        listDecks(userId),
        getDueCountsByDeck().catch(() => ({ dueByDeck: {} })),
      ]);
      setDecks(fetched);
      setDueByDeck(due);
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

  // Nach dem Lernen am Handy standen die „N fällig"-Abzeichen im offenen
  // Laptop-Tab weiter auf dem alten Stand (#610). Nur die Decks nachladen —
  // die Ordner-Zählung macht eine Anfrage je Ordner und ändert sich beim
  // Lernen nicht.
  useRefreshOnFocus(loadDecks);

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenu]);

  // Karten-Suche: entprellt (300 ms), damit nicht jeder Tastendruck eine
  // Anfrage auslöst; unter zwei Zeichen fragen wir gar nicht, weil der Server
  // dann ohnehin leer antwortet. Ein Fehler bleibt still — die Deck-Liste
  // darf an einer scheiternden Zusatzsuche nicht hängen (wie in der App).
  useEffect(() => {
    const term = query.trim();
    if (tab !== "decks" || term.length < 2) {
      setCardHits([]);
      setCardsSearching(false);
      return;
    }
    let cancelled = false;
    setCardsSearching(true);
    const timer = setTimeout(() => {
      searchCards(term)
        .then(({ results }) => {
          if (!cancelled) setCardHits(results);
        })
        .catch(() => {
          if (!cancelled) setCardHits([]);
        })
        .finally(() => {
          if (!cancelled) setCardsSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [decks, query]);

  // How many folders sit directly inside each folder — the "N Unterordner" hint
  // on a top-level card so people know the tree continues below it.
  const childCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of folders) {
      if (f.parentId) counts[f.parentId] = (counts[f.parentId] ?? 0) + 1;
    }
    return counts;
  }, [folders]);

  const filteredFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Reihenfolge ist umschaltbar (#612) — A–Z oder neueste zuerst.
    const sorted = sortFolders(folders, folderSort);
    // Default view is a tree: show only the top level, you click into a folder
    // to see its subfolders. Searching lifts that — it reaches every folder at
    // any depth (with its path shown) so nothing nested becomes unfindable.
    if (!q) return sorted.filter((f) => !f.parentId);
    return sorted.filter((f) => f.title.toLowerCase().includes(q));
  }, [folders, query, folderSort]);

  // Karten-Treffer über der Deck-Liste, wie im Deck-Tab der App: Überschrift
  // („Karten werden durchsucht…" bzw. „Karten · N Treffer"), darunter je Treffer
  // Frage, Antwort und das Deck. Ein Klick öffnet das Deck.
  const searchTerm = query.trim();
  const cardSection =
    tab === "decks" && searchTerm.length >= 2 && (cardsSearching || cardHits.length > 0) ? (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
        <span
          className="muted"
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {cardsSearching
            ? "Karten werden durchsucht…"
            : `Karten · ${cardHits.length} ${cardHits.length === 1 ? "Treffer" : "Treffer"}`}
        </span>
        {cardHits.map((hit) => (
          <Link
            key={hit.cardId}
            href={`/dashboard/deck/${hit.deckId}`}
            style={{
              display: "grid",
              gap: 2,
              minWidth: 0,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "10px 12px",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: "0.9rem",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {hit.front}
            </span>
            <span
              style={{
                fontSize: "0.85rem",
                color: "var(--ink-3)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {hit.back}
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--brand)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              in: {hit.deckTitle}
            </span>
          </Link>
        ))}
      </div>
    ) : null;

  return (
    <>
      <div className="lib-head">
        <div>
          {/* „Bibliothek" wie der App-Bildschirm (library.title), nicht „Meine …" */}
          <h1>Bibliothek</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {/* Solange die Liste lädt, keine falsche „0 Decks" zeigen (#499) */}
            {loading
              ? "Lädt…"
              : tab === "decks"
                ? `${decks.length} ${decks.length === 1 ? "Deck" : "Decks"}`
                : `${folders.length} ${folders.length === 1 ? "Ordner" : "Ordner"}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/dashboard/import" className="btn btn-ghost">
            <ScanLine size={16} /> Scan
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
        {/* Ein Suchtext für beide Reiter, wie die App (library.searchPlaceholder) */}
        <div className="input-icon">
          <span aria-hidden>
            <Search size={16} />
          </span>
          <input
            className="input"
            placeholder="Suchen..."
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
          <>
          {/* Reihenfolge umschalten (#612) — erst ab zwei Ordnern, darunter
              gibt es nichts zu sortieren. */}
          {folders.length > 1 && (
            <div className="folder-sort" role="group" aria-label="Reihenfolge der Ordner">
              <span className="folder-sort__icon" aria-hidden>
                <ArrowsSort size={15} />
              </span>
              {(
                [
                  ["alpha", "A–Z"],
                  ["recent", "Neueste"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`folder-sort__chip${folderSort === value ? " active" : ""}`}
                  aria-pressed={folderSort === value}
                  onClick={() => {
                    setFolderSort(value);
                    saveFolderSort(value);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="deck-grid">
            {filteredFolders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                path={folderPath(folder, folders)}
                count={folderCounts[folder.id]}
                childCount={childCounts[folder.id] ?? 0}
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
          </>
        )
      ) : filtered.length === 0 && !cardSection ? (
        <EmptyState hasDecks={decks.length > 0} onCreate={() => setModal({ type: "create" })} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 }}>
          {cardSection}
          {filtered.length > 0 && (
        <div className="deck-grid">
          {filtered.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              due={dueByDeck[deck.id] ?? 0}
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
              onSpeechLanguages={() => {
                setOpenMenu(null);
                setModal({ type: "speech", deck });
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
                } catch (e) {
                  // An der Deck-Grenze sagt der Server, woran es liegt und ob
                  // ein Upgrade hilft (#611) — „fehlgeschlagen" verschwieg das.
                  setPageError(adviceForLimit(e) ?? "Duplizieren fehlgeschlagen.");
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

      {modal?.type === "speech" && (
        <SpeechLanguageModal
          deck={modal.deck}
          onClose={() => setModal(null)}
          onSaved={async () => {
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
        <ShareModal deck={modal.deck} initialUrl={modal.url} onClose={() => setModal(null)} />
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

/**
 * Vorlese-Sprachen eines Decks (#571) — getrennt für Vorder- und Rückseite,
 * weil Vokabelkarten zweisprachig sind: vorne „les données", hinten „die
 * Daten". Eine Sprache fürs ganze Deck würde immer eine der beiden Seiten
 * falsch aussprechen.
 *
 * Zwei `select` statt Chips wie in der App: Im Browser ist das die Bedienform,
 * die auf Handy und Rechner gleichermaßen funktioniert und die Tastatur-
 * Bedienung geschenkt mitbringt.
 */
function SpeechLanguageModal({
  deck,
  onClose,
  onSaved,
}: {
  deck: Deck;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [front, setFront] = useState<SpeechLanguage>(toSpeechLanguage(deck.speechLangFront));
  const [back, setBack] = useState<SpeechLanguage>(toSpeechLanguage(deck.speechLangBack));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const options = SPEECH_LANGUAGES.map((l) => (
    <option key={l.code} value={l.code}>
      {l.label}
    </option>
  ));

  return (
    <Modal title="Sprache zum Vorlesen" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        Bestimmt, in welcher Sprache der Lautsprecher die jeweilige Seite von „{deck.title}"
        vorliest. Bei Vokabeln also vorne die Fremdsprache, hinten Deutsch.
      </p>

      <div className="field" style={{ marginBottom: 14 }}>
        <label htmlFor="speech-front">Vorderseite</label>
        <select
          id="speech-front"
          className="select"
          value={front}
          onChange={(e) => setFront(e.target.value as SpeechLanguage)}
          disabled={saving}
        >
          {options}
        </select>
      </div>

      <div className="field">
        <label htmlFor="speech-back">Rückseite</label>
        <select
          id="speech-back"
          className="select"
          value={back}
          onChange={(e) => setBack(e.target.value as SpeechLanguage)}
          disabled={saving}
        >
          {options}
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="modal__actions">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
          Abbrechen
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await updateDeck(deck.id, { speechLangFront: front, speechLangBack: back });
              await onSaved();
            } catch {
              setError("Speichern fehlgeschlagen.");
              setSaving(false);
            }
          }}
        >
          {saving ? "Speichern …" : "Speichern"}
        </button>
      </div>
    </Modal>
  );
}

function DeckCard({
  deck,
  due,
  menuOpen,
  onToggleMenu,
  onRename,
  onSpeechLanguages,
  onAddToFolder,
  onDuplicate,
  onShare,
  onDelete,
}: {
  deck: Deck;
  due: number;
  menuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onRename: () => void;
  onSpeechLanguages: () => void;
  onAddToFolder: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  // Bild-Karten müssen mitgenannt werden: Ohne sie meldete ein Deck, das nur
  // Bild-Karten hat, hier „0 Karten" — es wirkte leer, obwohl die Karten da sind.
  const count = deckCountLabel(deck.cardCount, deck.imageCardCount);
  // Technische Tags aus dem Scan-Flow („scan", „auto-generated") sind nicht für
  // Nutzeraugen gedacht — stattdessen ein freundliches KI-Abzeichen zeigen.
  const isAiCreated = deck.tags.some((t) => TECH_TAGS.has(t.toLowerCase()));
  const visibleTags = deck.tags.filter((t) => !TECH_TAGS.has(t.toLowerCase()));
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
          <span>{count ?? "Noch keine Karten"}</span>
          {due > 0 && <span className="tag tag--due">{due} fällig</span>}
          {isAiCreated && (
            <span className="tag tag--ai">
              <Sparkles size={11} /> KI-erstellt
            </span>
          )}
          {visibleTags.slice(0, 2).map((t) => (
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
            <button type="button" onClick={onSpeechLanguages}>
              <Volume2 size={15} /> Sprache zum Vorlesen
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
      {/* Wie bei den Decks: ohne Treffer nur die kurze Zeile (library.noMatchFolders).
          Der erklärende Satz bleibt für die wirklich leere Ordner-Liste. */}
      <h3>{hasFolders ? "Kein Ordner gefunden." : "Noch keine Ordner"}</h3>
      {!hasFolders && <p>Sortiere deine Decks in Ordner — zum Beispiel einen pro Fach.</p>}
      {!hasFolders && (
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          + Neuer Ordner
        </button>
      )}
    </div>
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
  const [search, setSearch] = useState("");
  const sorted = useMemo(
    () => [...folders].sort((a, b) => a.title.localeCompare(b.title, "de")),
    [folders]
  );
  // Gefiltert wird über den vollen Pfad ("Schule / Bio"), damit die Suche auch
  // Unterordner über den Namen des Elternordners findet.
  const shown = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("de");
    if (!q) return sorted;
    return sorted.filter((f) =>
      [...folderPath(f, folders), f.title].join(" / ").toLocaleLowerCase("de").includes(q)
    );
  }, [sorted, folders, search]);

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
        <>
        {sorted.length >= PICKER_SEARCH_THRESHOLD && (
          <div className="input-icon">
            <span aria-hidden>
              <Search size={16} />
            </span>
            <input
              className="input"
              placeholder="Ordner suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        {shown.length === 0 && (
          <p className="muted">Kein Ordner passt zu deiner Suche.</p>
        )}
        <div className="modal__scroll" style={{ display: "grid", gap: 8 }}>
          {shown.map((f) => {
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
        </>
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
      {/* Wortlaut der App (library.noMatchDecks / library.emptyDecks): bei einer
          Suche ohne Treffer nur die kurze Zeile ohne Zusatztext, bei leerer
          Bibliothek der Hinweis aufs Scannen. Die Knöpfe darunter bleiben —
          auch der für ein leeres Deck, den es im Web weiterhin gibt. */}
      <h3>{hasDecks ? "Kein Deck gefunden." : "Noch keine Decks."}</h3>
      {!hasDecks && <p>Scanne einen Text, um dein erstes Deck zu erstellen.</p>}
      {!hasDecks && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/dashboard/import" className="btn btn-primary">
            <ScanLine size={16} /> Scan
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
    } catch (e) {
      // Bei erreichter Deck-Grenze hilft kein zweiter Versuch — dann steht
      // hier der Klartext des Servers samt Ausweg (#611).
      setError(adviceForLimit(e) ?? "Das hat nicht geklappt. Bitte versuche es erneut.");
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
  deck,
  initialUrl,
  onClose,
}: {
  deck: Deck;
  initialUrl: string;
  onClose: () => void;
}) {
  // url === null means the link was just deactivated (#519); the dialog then
  // offers to mint a fresh one. `confirming` gates the deactivation behind a
  // safety prompt so a stray click can't kill a shared link.
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Modal title="Deck teilen" onClose={onClose}>
      {url ? (
        <>
          <p className="muted">
            Jeder mit diesem Link kann „{deck.title}" ansehen und als eigene Kopie übernehmen.
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

          {confirming ? (
            <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 14 }}>
              <p className="muted" style={{ margin: 0 }}>
                Link wirklich deaktivieren? Der bisher geteilte Link funktioniert danach nicht
                mehr — wer ihn schon hat, kommt nicht mehr an das Deck. Beim nächsten Teilen
                entsteht ein neuer Link.
              </p>
              {error && (
                <p style={{ color: "#dc2626", margin: "8px 0 0" }}>{error}</p>
              )}
              <div className="modal__actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => {
                    setConfirming(false);
                    setError(null);
                  }}
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ background: "#dc2626", boxShadow: "none" }}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await revokeDeckShare(deck.id);
                      setUrl(null);
                      setConfirming(false);
                    } catch {
                      setError("Deaktivieren fehlgeschlagen. Bitte erneut versuchen.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? "Wird deaktiviert…" : "Ja, deaktivieren"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ borderTop: "1px solid var(--line)", marginTop: 14, paddingTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ color: "#dc2626" }}
                  onClick={() => setConfirming(true)}
                >
                  <LinkIcon size={15} /> Link deaktivieren
                </button>
                <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
                  Der bisherige Link funktioniert danach nicht mehr.
                </p>
              </div>
              <div className="modal__actions">
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Schließen
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--green)",
              margin: "4px 0 14px",
            }}
          >
            <CheckCircle size={18} /> Link deaktiviert. Der alte Link funktioniert nicht mehr.
          </div>
          {error && <p style={{ color: "#dc2626", marginTop: 0 }}>{error}</p>}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const { shareUrl } = await shareDeck(deck.id);
                setUrl(shareUrl);
              } catch {
                setError("Neuer Link fehlgeschlagen. Bitte erneut versuchen.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <RefreshSync size={15} /> {busy ? "Wird erstellt…" : "Neuen Link erstellen"}
          </button>
          <div className="modal__actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Schließen
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
