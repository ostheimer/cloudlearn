"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { Modal } from "@/components/app/modal";
import {
  listDecks,
  listFolders,
  listDecksInFolder,
  addDeckToFolder,
  removeDeckFromFolder,
  setFolderDeckOrder,
  createFolder,
  updateFolder,
  deleteFolder,
  getDueCountsByDeck,
  isApiError,
  type Deck,
  type Folder,
} from "@/lib/api";
import { buildFolderCountLabel, descendantFolders, folderPath } from "@/lib/folders";
import { handleMenuKey } from "@/lib/menu-keys";
import { FolderCard, DeleteFolderModal, FolderNameModal } from "@/components/app/folder-ui";
import { deckCountLabel } from "@/lib/deck-count-label";
import {
  ArrowLeft,
  Layers,
  Folder as FolderIcon,
  AlertTriangle,
  Trash,
  Play,
  Pencil,
  GripVertical,
  Search,
} from "@/components/icons";

// Ab dieser Listenlänge zeigt der Deck-Picker ein Suchfeld (#612) — gleicher
// Wert wie im Ordner-Picker der Bibliothek und in den App-Pickern.
const PICKER_SEARCH_THRESHOLD = 6;

type SubfolderModal =
  | { type: "create" }
  | { type: "rename"; folder: Folder }
  | { type: "delete"; folder: Folder }
  | null;

// Kleine Abschnitts-Überschrift ("Unterordner" / "Decks"), wie die App-Sektionen.
const sectionLabelStyle: React.CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  fontSize: "0.72rem",
  fontWeight: 700,
  margin: "0 0 10px",
};

export default function FolderDetailPage() {
  const params = useParams<{ id: string }>();
  const folderId = params.id;
  const router = useRouter();
  const { userId } = useAuth();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [allDecks, setAllDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  // undefined = still counting. The button stays usable either way; only its
  // label waits for the number.
  const [dueCount, setDueCount] = useState<number | undefined>(undefined);
  // Fällige Karten je Deck ("N fällig"-Abzeichen auf den Kacheln).
  const [dueByDeck, setDueByDeck] = useState<Record<string, number>>({});
  // Deck-Zahl je Unterordner (für den „N Decks"-Text auf der Unterordner-Kachel).
  const [subCounts, setSubCounts] = useState<Record<string, number>>({});
  // Welches Unterordner-Menü offen ist; steuert dasselbe Öffnen/Umbenennen/Löschen
  // wie in der Bibliothek. Ohne diese Seite wären Unterordner sonst unverwaltbar,
  // weil die Bibliothek nur noch die oberste Ebene zeigt.
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);
  const [subModal, setSubModal] = useState<SubfolderModal>(null);

  // Welcher Karten-Index gerade am Griff gezogen wird; null = kein Ziehen.
  // Die Liste wird schon WÄHREND des Ziehens umsortiert (sichtbares Feedback),
  // gespeichert wird erst beim Loslassen.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Der Pointer-Up-Handler ist eine alte Closure — er würde den Deck-Stand vom
  // Beginn des Zugs speichern. Der Ref zeigt immer auf den neuesten Stand.
  const decksRef = useRef<Deck[]>([]);
  useEffect(() => {
    decksRef.current = decks;
  }, [decks]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [{ folders: fetchedFolders }, { decks: inFolder }, { decks: mine }] =
        await Promise.all([listFolders(), listDecksInFolder(folderId), listDecks(userId)]);
      setFolders(fetchedFolders);
      setDecks(inFolder);
      setAllDecks(mine);
      setPageError(null);

      // Deck counts for this folder's subfolders — same best-effort pattern as
      // the library tab. A failed count shows as "Anzahl unbekannt" rather than
      // breaking the page.
      try {
        const kids = fetchedFolders.filter((f) => f.parentId === folderId);
        const counts = await Promise.all(
          kids.map(async (f) => {
            try {
              const { decks: inSub } = await listDecksInFolder(f.id);
              return [f.id, inSub.length] as const;
            } catch {
              return [f.id, -1] as const;
            }
          })
        );
        setSubCounts(Object.fromEntries(counts));
      } catch {
        setSubCounts({});
      }

      // How many of this folder's cards are due today. The grouped count is
      // global, so filter by the folder's decks — the server applies the same
      // filters as /learn/due (#612), so the number on the button still
      // matches the round the learn page starts.
      try {
        const ids = new Set(inFolder.map((d) => d.id));
        const { dueByDeck: allCounts } = await getDueCountsByDeck();
        // Je Deck fürs "N fällig"-Abzeichen auf den Kacheln, die Summe für
        // den Lern-Knopf (wie in der App-Bibliothek).
        const counts: Record<string, number> = {};
        let total = 0;
        for (const [deckId, n] of Object.entries(allCounts)) {
          if (!ids.has(deckId)) continue;
          counts[deckId] = n;
          total += n;
        }
        setDueCount(total);
        setDueByDeck(counts);
      } catch {
        // A missing count must not break the page — the button just says „Fällige lernen".
        setDueCount(undefined);
      }
    } catch (e) {
      // The API answers 404 for a folder that isn't the caller's, so a missing
      // folder and someone else's folder look the same here — by design.
      if (isApiError(e) && e.status === 404) setNotFound(true);
      else setPageError("Der Ordner konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [folderId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Klick irgendwo schließt ein offenes Unterordner-Menü (wie in der Bibliothek);
  // Escape und Pfeiltasten wie dort (#613).
  useEffect(() => {
    if (!openSubMenu) return;
    const close = () => setOpenSubMenu(null);
    const onKey = (e: KeyboardEvent) => handleMenuKey(e, close);
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [openSubMenu]);

  const folder = useMemo(() => folders.find((f) => f.id === folderId), [folders, folderId]);
  const path = useMemo(() => (folder ? folderPath(folder, folders) : []), [folder, folders]);
  // The folders directly inside this one, alphabetically — the "Unterordner"
  // section. Clicking one opens it, so you walk the tree the same way as in the app.
  const subfolders = useMemo(
    () =>
      folders
        .filter((f) => f.parentId === folderId)
        .sort((a, b) => a.title.localeCompare(b.title, "de")),
    [folders, folderId]
  );
  // How many folders sit inside each subfolder — the "N Unterordner" hint on its card.
  const childCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of folders) {
      if (f.parentId) counts[f.parentId] = (counts[f.parentId] ?? 0) + 1;
    }
    return counts;
  }, [folders]);
  const addable = useMemo(() => {
    const inFolder = new Set(decks.map((d) => d.id));
    return allDecks
      .filter((d) => !inFolder.has(d.id))
      .sort((a, b) => a.title.localeCompare(b.title, "de"));
  }, [allDecks, decks]);
  // The API's cardCount already excludes occlusion and deleted cards — the same
  // ones the learn page drops — so this total matches the round it starts.
  const totalCards = useMemo(
    () => decks.reduce((sum, d) => sum + (d.cardCount ?? 0), 0),
    [decks]
  );

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/dashboard");
  }

  // ─── Reihenfolge per Ziehgriff (#437) ─────────────────────────────────────
  // Pointer-Events statt HTML5-Drag&Drop: Letzteres feuert auf dem Handy nicht.
  // Der Griff trägt `touch-action: none`, damit der Browser dort nicht scrollt
  // — nur dort, die Karte selbst bleibt normal scroll- und klickbar.

  function onGripPointerDown(e: React.PointerEvent<HTMLButtonElement>, index: number) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragIndex(index);
  }

  function onGripPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragIndex === null) return;
    // Pointer-Capture leitet alle Events auf den Griff um — welches Element
    // unter dem Finger liegt, verrät deshalb nur elementFromPoint.
    const over = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-deck-index]");
    if (!over) return;
    const target = Number(over.dataset.deckIndex);
    if (Number.isNaN(target) || target === dragIndex) return;
    setDecks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      if (!moved) return prev;
      next.splice(target, 0, moved);
      return next;
    });
    setDragIndex(target);
  }

  async function onGripPointerUp() {
    if (dragIndex === null) return;
    setDragIndex(null);
    try {
      await setFolderDeckOrder(
        folderId,
        decksRef.current.map((d) => d.id)
      );
    } catch {
      // Erst neu laden, DANN die Meldung setzen — load() räumt pageError bei
      // Erfolg auf, in der anderen Reihenfolge verschwände sie sofort wieder
      // und das Zurückspringen der Karten bliebe unerklärt.
      await load();
      setPageError("Die Reihenfolge konnte nicht gespeichert werden.");
    }
  }

  if (notFound) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <FolderIcon size={30} />
        </div>
        <h3>Ordner nicht gefunden</h3>
        <p>Dieser Ordner existiert nicht mehr.</p>
        <Link href="/dashboard" className="btn btn-primary">
          Zur Bibliothek
        </Link>
      </div>
    );
  }

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
          {path.length > 0 && (
            <p className="muted" style={{ fontSize: "0.82rem" }}>
              {path.join(" / ")}
            </p>
          )}
          {/* overflowWrap: ein Titel ohne Leerzeichen darf die Seite nicht
              horizontal aufschieben (#612). */}
          <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, overflowWrap: "anywhere" }}>
            {folder?.title ?? "Ordner"}
          </h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {buildFolderCountLabel(subfolders.length, decks.length, totalCards)}
          </p>
          {folder &&
            (folder.description ? (
              <p className="muted" style={{ marginTop: 8, maxWidth: 560 }}>
                {folder.description}
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 26, height: 26, verticalAlign: "middle", marginLeft: 4 }}
                  aria-label="Beschreibung bearbeiten"
                  title="Beschreibung bearbeiten"
                  onClick={() => setEditingDescription(true)}
                >
                  <Pencil size={14} />
                </button>
              </p>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 8, padding: "4px 10px", fontSize: "0.85rem" }}
                onClick={() => setEditingDescription(true)}
              >
                + Beschreibung
              </button>
            ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setSubModal({ type: "create" })}
            disabled={loading}
          >
            + Neuer Unterordner
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setPicking(true)}
            disabled={loading}
          >
            + Decks hinzufügen
          </button>
        </div>
      </div>

      {!loading && totalCards > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
          {/* Nothing due → „Alle lernen" is the only useful action, so it takes
              the accent. Otherwise the loud button would be the dead one. */}
          <Link
            href={`/dashboard/folder/${folderId}/learn?mode=due`}
            className={dueCount === 0 ? "btn btn-ghost" : "btn btn-primary"}
            style={{ flex: "1 1 180px", justifyContent: "center" }}
          >
            {dueCount !== 0 && <Play size={16} />}
            {dueCount === undefined ? "Fällige lernen" : `${dueCount} fällig lernen`}
          </Link>
          <Link
            href={`/dashboard/folder/${folderId}/learn?mode=all`}
            className={dueCount === 0 ? "btn btn-primary" : "btn btn-ghost"}
            style={{ flex: "1 1 180px", justifyContent: "center" }}
          >
            {dueCount === 0 && <Play size={16} />}
            Alle {totalCards} lernen
          </Link>
        </div>
      )}

      {pageError && (
        <div className="form-error" role="alert" style={{ marginBottom: 18 }}>
          <AlertTriangle size={16} />
          <span>{pageError}</span>
        </div>
      )}

      {loading ? (
        <div className="spinner" />
      ) : (
        <>
          {subfolders.length > 0 && (
            <>
              <div className="muted" style={sectionLabelStyle}>
                Unterordner
              </div>
              <div className="deck-grid" style={{ marginBottom: 24 }}>
                {subfolders.map((sub) => (
                  <FolderCard
                    key={sub.id}
                    folder={sub}
                    count={subCounts[sub.id]}
                    childCount={childCounts[sub.id] ?? 0}
                    menuOpen={openSubMenu === sub.id}
                    onToggleMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenSubMenu((cur) => (cur === sub.id ? null : sub.id));
                    }}
                    onRename={() => {
                      setOpenSubMenu(null);
                      setSubModal({ type: "rename", folder: sub });
                    }}
                    onDelete={() => {
                      setOpenSubMenu(null);
                      setSubModal({ type: "delete", folder: sub });
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {subfolders.length > 0 && decks.length > 0 && (
            <div className="muted" style={sectionLabelStyle}>
              Decks
            </div>
          )}

          {decks.length === 0 ? (
            subfolders.length > 0 ? (
              // Es gibt schon Unterordner — dann ist ein leerer Deck-Bereich kein
              // leerer Ordner. Ein schlichter Hinweis statt der großen leeren Fläche.
              <div
                className="muted"
                style={{
                  border: "1px dashed var(--line)",
                  borderRadius: 12,
                  padding: 18,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span>Noch keine Decks in diesem Ordner.</span>
                <button type="button" className="btn btn-ghost" onClick={() => setPicking(true)}>
                  + Decks hinzufügen
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <div className="ic" aria-hidden>
                  <Layers size={30} />
                </div>
                <h3>Noch keine Decks in diesem Ordner</h3>
                <p>Leg Decks hier ab, um sie zusammen zu halten.</p>
                <button type="button" className="btn btn-primary" onClick={() => setPicking(true)}>
                  + Decks hinzufügen
                </button>
              </div>
            )
          ) : (
            <div className="deck-grid">
              {decks.map((deck, index) => (
            <div
              key={deck.id}
              data-deck-index={index}
              style={{
                position: "relative",
                // Die gezogene Karte hebt sich ab, damit man sieht, WAS man
                // gerade bewegt — die anderen rutschen darunter zurecht.
                ...(dragIndex === index
                  ? { opacity: 0.75, transform: "scale(1.02)", zIndex: 2 }
                  : null),
              }}
            >
              <Link href={`/dashboard/deck/${deck.id}`} className="deck-card">
                <div className="deck-card__top">
                  <span className="deck-card__badge" aria-hidden>
                    <Layers size={18} />
                  </span>
                </div>
                <div className="deck-card__title">{deck.title}</div>
                <div className="deck-card__meta">
                  <span>
                    {deck.cardCount === undefined
                      ? "Karten werden gezählt…"
                      : (deckCountLabel(deck.cardCount, deck.imageCardCount) ??
                        "Noch keine Karten")}
                  </span>
                  {(dueByDeck[deck.id] ?? 0) > 0 && (
                    <span className="tag tag--due">{dueByDeck[deck.id]} fällig</span>
                  )}
                </div>
              </Link>
              {/* Griff nur zeigen, wenn Sortieren etwas bewirken kann. */}
              {decks.length > 1 && (
                <button
                  type="button"
                  className="icon-btn"
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 52,
                    touchAction: "none",
                    cursor: dragIndex === index ? "grabbing" : "grab",
                  }}
                  aria-label={`„${deck.title}" verschieben`}
                  title="Ziehen zum Sortieren"
                  onPointerDown={(e) => onGripPointerDown(e, index)}
                  onPointerMove={onGripPointerMove}
                  onPointerUp={onGripPointerUp}
                  onPointerCancel={onGripPointerUp}
                >
                  <GripVertical size={18} />
                </button>
              )}
              <button
                type="button"
                className="icon-btn"
                style={{ position: "absolute", top: 12, right: 12 }}
                aria-label={`„${deck.title}" aus dem Ordner entfernen`}
                title="Aus dem Ordner entfernen"
                onClick={async () => {
                  setDecks((prev) => prev.filter((d) => d.id !== deck.id));
                  try {
                    await removeDeckFromFolder(folderId, deck.id);
                  } catch {
                    // load() vor der Meldung — sonst räumt es sie gleich
                    // wieder weg (siehe onGripPointerUp).
                    await load();
                    setPageError("Das Deck konnte nicht entfernt werden.");
                  }
                }}
              >
                <Trash size={18} />
              </button>
            </div>
          ))}
            </div>
          )}
        </>
      )}

      {picking && (
        <AddDecksModal
          decks={addable}
          onClose={() => setPicking(false)}
          onAdd={async (deckIds) => {
            await Promise.all(deckIds.map((id) => addDeckToFolder(folderId, id)));
            setPicking(false);
            await load();
          }}
        />
      )}

      {editingDescription && folder && (
        <EditDescriptionModal
          initial={folder.description ?? ""}
          onClose={() => setEditingDescription(false)}
          onSubmit={async (value) => {
            const { folder: updated } = await updateFolder(folderId, { description: value });
            // Nur den einen Ordner austauschen — ein voller Reload würde die
            // Deck-Zähler erneut anfragen, obwohl sich an Decks nichts ändert.
            setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
            setEditingDescription(false);
          }}
        />
      )}

      {subModal?.type === "create" && (
        <FolderNameModal
          title="Neuer Unterordner"
          confirmLabel="Erstellen"
          onClose={() => setSubModal(null)}
          onSubmit={async (value) => {
            if (!userId) return;
            const { folder: created } = await createFolder(userId, value, folderId);
            // A fresh subfolder holds nothing yet — append it and seed its count
            // instead of a full reload.
            setFolders((prev) => [...prev, created]);
            setSubCounts((prev) => ({ ...prev, [created.id]: 0 }));
            setSubModal(null);
          }}
        />
      )}

      {subModal?.type === "rename" && (
        <FolderNameModal
          title="Unterordner umbenennen"
          confirmLabel="Speichern"
          initial={subModal.folder.title}
          onClose={() => setSubModal(null)}
          onSubmit={async (value) => {
            const { folder: updated } = await updateFolder(subModal.folder.id, { title: value });
            setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
            setSubModal(null);
          }}
        />
      )}

      {subModal?.type === "delete" && (
        <DeleteFolderModal
          folder={subModal.folder}
          folders={folders}
          onClose={() => setSubModal(null)}
          onConfirm={async () => {
            const id = subModal.folder.id;
            // parent_id cascades in the database, so the subfolders the dialog
            // just named go too — drop the whole branch at once and only reload
            // if the server disagrees.
            const gone = new Set([id, ...descendantFolders(id, folders).map((f) => f.id)]);
            setSubModal(null);
            setFolders((prev) => prev.filter((f) => !gone.has(f.id)));
            try {
              await deleteFolder(id);
            } catch {
              setPageError("Ordner konnte nicht gelöscht werden.");
              await load();
            }
          }}
        />
      )}
    </div>
  );
}

function EditDescriptionModal({
  initial,
  onClose,
  onSubmit,
}: {
  initial: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // Leer abschicken ist erlaubt — so löscht man eine Beschreibung wieder.
      await onSubmit(value.trim());
    } catch {
      setError("Das hat nicht geklappt. Bitte versuche es erneut.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Beschreibung" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <div className="field">
          <label htmlFor="folder-description">Worum geht es in diesem Ordner?</label>
          <textarea
            id="folder-description"
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="z. B. Grundkurs Deutsch für Anfänger"
            disabled={busy}
            maxLength={500}
            rows={3}
            style={{ resize: "vertical", minHeight: 72 }}
            autoFocus
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
            {busy ? "Bitte warten…" : "Speichern"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddDecksModal({
  decks,
  onClose,
  onAdd,
}: {
  decks: Deck[];
  onClose: () => void;
  onAdd: (deckIds: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Nur die Anzeige wird gefiltert — die Auswahl bleibt erhalten, auch wenn
  // ein bereits angehaktes Deck gerade nicht zur Suche passt.
  const shown = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("de");
    if (!q) return decks;
    return decks.filter((d) => d.title.toLocaleLowerCase("de").includes(q));
  }, [decks, search]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    // Überschrift und Knopf wie in der App (#571): dort heißt das Fenster
    // „Decks auswählen" und der Knopf nennt die Einheit mit — „3 Decks
    // hinzufügen" statt „3 hinzufügen".
    <Modal title="Decks auswählen" onClose={onClose}>
      {decks.length === 0 ? (
        <p className="muted">Alle deine Decks liegen schon in diesem Ordner.</p>
      ) : (
        <>
          <p className="muted">Wähle die Decks aus, die in diesen Ordner sollen.</p>
          {decks.length >= PICKER_SEARCH_THRESHOLD && (
            <div className="input-icon">
              <span aria-hidden>
                <Search size={16} />
              </span>
              <input
                className="input"
                placeholder="Deck suchen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          {shown.length === 0 && <p className="muted">Kein Deck passt zu deiner Suche.</p>}
          <div className="modal__scroll" style={{ display: "grid", gap: 8 }}>
            {shown.map((deck) => (
              <label
                key={deck.id}
                className="btn btn-ghost"
                style={{ justifyContent: "flex-start", cursor: "pointer", gap: 10 }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(deck.id)}
                  onChange={() => toggle(deck.id)}
                  disabled={busy}
                />
                <span>{deck.title}</span>
              </label>
            ))}
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
        {decks.length > 0 && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || selected.size === 0}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onAdd([...selected]);
              } catch {
                setError("Das hat nicht geklappt. Bitte versuche es erneut.");
                setBusy(false);
              }
            }}
          >
            {busy
              ? "Bitte warten…"
              : selected.size === 1
                ? "1 Deck hinzufügen"
                : `${selected.size} Decks hinzufügen`}
          </button>
        )}
      </div>
    </Modal>
  );
}
