"use client";

import { useRef, useState, type FormEvent } from "react";
import { Modal } from "@/components/app/modal";
import { adviceForLimit } from "@/lib/import-limits";
import { AlertTriangle } from "@/components/icons";
import { DIFFICULTIES, difficultyLabel } from "@/lib/card-labels";
import type { Card } from "@/lib/api";

/**
 * Karte anlegen oder bearbeiten — geteilt zwischen der Deck-Seite und dem
 * Stift-Knopf in den Lernrunden (#610). Bewusst nur Vorder-/Rückseite, kein
 * Typ-Umschalter: cloze↔basic wird serverseitig aus dem Text abgeleitet.
 */
export function CardEditor({
  initial,
  onClose,
  onSubmit,
}: {
  initial?: Card | undefined;
  onClose: () => void;
  onSubmit: (front: string, back: string, difficulty: string) => Promise<void>;
}) {
  const [front, setFront] = useState(initial?.front ?? "");
  const [back, setBack] = useState(initial?.back ?? "");
  // Schwierigkeit (#571 Teil B) — die App kann sie seit jeher setzen, das Web
  // nicht. „medium" ist auch serverseitig der Standard für neue Karten.
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Nachfrage vor dem Verwerfen (#608): Escape, Klick neben das Fenster und
  // „Abbrechen" werfen sonst halbfertigen Text kommentarlos weg.
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const dirty =
    front !== (initial?.front ?? "") ||
    back !== (initial?.back ?? "") ||
    difficulty !== (initial?.difficulty ?? "medium");

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

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim()) {
      setError("Bitte Vorder- und Rückseite ausfüllen.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(front.trim(), back.trim(), difficulty);
    } catch (e) {
      // Am vollen Deck hilft kein zweiter Versuch — dann steht hier, wie viele
      // Karten der Tarif erlaubt und was der Ausweg ist (#611).
      setError(adviceForLimit(e) ?? "Speichern fehlgeschlagen. Bitte versuche es erneut.");
      setBusy(false);
    }
  }

  return (
    <>
    <Modal
      title={initial ? "Karte bearbeiten" : "Neue Karte"}
      onClose={requestClose}
      active={!confirmDiscard}
      initialFocusRef={frontRef}
    >
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <div className="card-editor">
          <div className="field">
            <label htmlFor="front">Vorderseite (Frage)</label>
            <textarea
              id="front"
              ref={frontRef}
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
        {/* Schwierigkeit wie in der App (#571 Teil B). Drei Knöpfe statt einer
            Auswahlliste — dieselbe Bedienung wie dort, und am Handy trifft man
            sie besser. */}
        <div className="field">
          <span className="field__label">Schwierigkeit</span>
          <div style={{ display: "flex", gap: 8 }}>
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                disabled={busy}
                aria-pressed={difficulty === d}
                className={difficulty === d ? "btn btn-primary" : "btn btn-ghost"}
                style={{ flex: 1 }}
              >
                {difficultyLabel(d)}
              </button>
            ))}
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
    </Modal>
    {confirmDiscard && (
      <Modal
        title="Änderungen verwerfen?"
        role="alertdialog"
        onClose={() => setConfirmDiscard(false)}
        initialFocusRef={keepEditingRef}
      >
        <p className="muted" style={{ margin: 0 }}>Dein eingetippter Text geht sonst verloren.</p>
        <div className="modal__actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Verwerfen</button>
          <button ref={keepEditingRef} type="button" className="btn btn-primary" onClick={() => setConfirmDiscard(false)}>
            Weiter bearbeiten
          </button>
        </div>
      </Modal>
    )}
    </>
  );
}
