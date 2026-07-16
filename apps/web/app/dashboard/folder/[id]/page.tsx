"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { Modal } from "@/components/app/modal";
import {
  listDecks,
  listFolders,
  listDecksInFolder,
  addDeckToFolder,
  removeDeckFromFolder,
  isApiError,
  type Deck,
  type Folder,
} from "@/lib/api";
import { folderPath } from "@/lib/folders";
import {
  ArrowLeft,
  Layers,
  Folder as FolderIcon,
  AlertTriangle,
  Trash,
} from "@/components/icons";

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

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [{ folders: fetchedFolders }, { decks: inFolder }, { decks: mine }] =
        await Promise.all([listFolders(), listDecksInFolder(folderId), listDecks(userId)]);
      setFolders(fetchedFolders);
      setDecks(inFolder);
      setAllDecks(mine);
      setPageError(null);
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

  const folder = useMemo(() => folders.find((f) => f.id === folderId), [folders, folderId]);
  const path = useMemo(() => (folder ? folderPath(folder, folders) : []), [folder, folders]);
  const addable = useMemo(() => {
    const inFolder = new Set(decks.map((d) => d.id));
    return allDecks
      .filter((d) => !inFolder.has(d.id))
      .sort((a, b) => a.title.localeCompare(b.title, "de"));
  }, [allDecks, decks]);

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/dashboard");
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
          <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800 }}>
            {folder?.title ?? "Ordner"}
          </h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {decks.length} {decks.length === 1 ? "Deck" : "Decks"}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setPicking(true)}
          disabled={loading}
        >
          + Decks hinzufügen
        </button>
      </div>

      {pageError && (
        <div className="form-error" role="alert" style={{ marginBottom: 18 }}>
          <AlertTriangle size={16} />
          <span>{pageError}</span>
        </div>
      )}

      {loading ? (
        <div className="spinner" />
      ) : decks.length === 0 ? (
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
      ) : (
        <div className="deck-grid">
          {decks.map((deck) => (
            <div key={deck.id} style={{ position: "relative" }}>
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
                      : `${deck.cardCount} ${deck.cardCount === 1 ? "Karte" : "Karten"}`}
                  </span>
                </div>
              </Link>
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
                    setPageError("Das Deck konnte nicht entfernt werden.");
                    await load();
                  }
                }}
              >
                <Trash size={18} />
              </button>
            </div>
          ))}
        </div>
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
    </div>
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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal title="Decks hinzufügen" onClose={onClose}>
      {decks.length === 0 ? (
        <p className="muted">Alle deine Decks liegen schon in diesem Ordner.</p>
      ) : (
        <>
          <p className="muted">Wähle die Decks aus, die in diesen Ordner sollen.</p>
          <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
            {decks.map((deck) => (
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
            {busy ? "Bitte warten…" : `${selected.size} hinzufügen`}
          </button>
        )}
      </div>
    </Modal>
  );
}
