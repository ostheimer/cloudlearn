"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/app/modal";
import { descendantFolders, folderDeleteQuestion } from "@/lib/folders";
import type { Folder } from "@/lib/api";
import {
  Folder as FolderIcon,
  MoreHorizontal,
  Pencil,
  Trash,
  AlertTriangle,
} from "@/components/icons";

/**
 * Shared folder building blocks used by both the library ("Ordner" tab) and the
 * folder detail page. Keeping the delete dialog here means its cascade warning —
 * which names the subfolders that go with the folder — lives in exactly one
 * place, so the two pages can never drift apart on that safety copy.
 */

export function FolderCard({
  folder,
  path,
  count,
  childCount = 0,
  menuOpen,
  onToggleMenu,
  onRename,
  onDelete,
}: {
  folder: Folder;
  /** Ancestor titles, shown as a breadcrumb. Empty/undefined hides the line. */
  path?: string[];
  /** Deck count; undefined = still loading, negative = count unavailable. */
  count: number | undefined;
  /** How many folders sit directly inside this one. */
  childCount?: number;
  menuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const deckText =
    count === undefined
      ? "Wird geladen…"
      : count < 0
        ? "Anzahl unbekannt"
        : `${count} ${count === 1 ? "Deck" : "Decks"}`;

  return (
    <div style={{ position: "relative" }}>
      <Link href={`/dashboard/folder/${folder.id}`} className="deck-card">
        <div className="deck-card__top">
          <span className="deck-card__badge" aria-hidden>
            <FolderIcon size={18} />
          </span>
        </div>
        {path && path.length > 0 && (
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
            {deckText}
            {childCount > 0 && ` · ${childCount} Unterordner`}
          </span>
        </div>
      </Link>

      <div className="pop" style={{ position: "absolute", top: 12, right: 12 }}>
        <button
          type="button"
          className="icon-btn"
          aria-label="Ordner-Optionen"
          aria-haspopup="menu"
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
            <button type="button" role="menuitem" onClick={onRename}>
              <Pencil size={15} /> Umbenennen
            </button>
            <button type="button" role="menuitem" className="danger" onClick={onDelete}>
              <Trash size={15} /> Löschen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DeleteFolderModal({
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
  // the tree gives no other clue that they belong together.
  const doomed = descendantFolders(folder.id, folders);
  return (
    <Modal title="Ordner löschen" onClose={onClose}>
      <p className="muted">
        {folderDeleteQuestion(
          folder.title,
          doomed.map((f) => f.title)
        )}
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

export function FolderNameModal({
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
      setError("Bitte gib einen Namen ein.");
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
          <label htmlFor="folder-name">Ordnername</label>
          <input
            id="folder-name"
            ref={inputRef}
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            // Ein Beispiel für alle Ordner-Felder (#571): Vorher stand hier
            // „z. B. Statistik" und in der Bibliothek „z. B. Schule".
            placeholder="z. B. Schule"
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
