"use client";

import { useState, type FormEvent } from "react";
import { Modal } from "@/components/app/modal";
import { adviceForLimit } from "@/lib/import-limits";
import { AlertTriangle } from "@/components/icons";
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
  onSubmit: (front: string, back: string) => Promise<void>;
}) {
  const [front, setFront] = useState(initial?.front ?? "");
  const [back, setBack] = useState(initial?.back ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Nachfrage vor dem Verwerfen (#608): Escape, Klick neben das Fenster und
  // „Abbrechen" werfen sonst halbfertigen Text kommentarlos weg.
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const dirty = front !== (initial?.front ?? "") || back !== (initial?.back ?? "");

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
      await onSubmit(front.trim(), back.trim());
    } catch (e) {
      // Am vollen Deck hilft kein zweiter Versuch — dann steht hier, wie viele
      // Karten der Tarif erlaubt und was der Ausweg ist (#611).
      setError(adviceForLimit(e) ?? "Speichern fehlgeschlagen. Bitte versuche es erneut.");
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "Karte bearbeiten" : "Neue Karte"} onClose={requestClose}>
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
          <button type="button" className="btn btn-ghost" onClick={requestClose} disabled={busy}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Bitte warten…" : initial ? "Speichern" : "Hinzufügen"}
          </button>
        </div>
      </form>
      {confirmDiscard && (
        // Liegt im DOM hinter dem Editor-Overlay und damit optisch darüber —
        // dieselben Modal-Bausteine, nur schmaler. Klick neben das Fenster
        // heißt hier „Weiter bearbeiten": Die zerstörende Wahl braucht einen
        // ausdrücklichen Knopfdruck.
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmDiscard(false);
          }}
        >
          <div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-label="Änderungen verwerfen?"
            style={{ maxWidth: 340 }}
          >
            <h3 className="h3">Änderungen verwerfen?</h3>
            <p className="muted" style={{ margin: 0 }}>
              Dein eingetippter Text geht sonst verloren.
            </p>
            <div className="modal__actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Verwerfen
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setConfirmDiscard(false)}
                autoFocus
              >
                Weiter bearbeiten
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
