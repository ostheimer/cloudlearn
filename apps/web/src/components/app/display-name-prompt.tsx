"use client";

import { useEffect, useState } from "react";
import {
  getProfile,
  updateDisplayName,
  displayNameErrorMessage,
} from "@/lib/api";
import { AlertTriangle, User } from "@/components/icons";

/**
 * Einmalige Namensabfrage für Konten ohne Anzeigenamen (mit Lara abgestimmt:
 * Pflicht). Hat die Registrierung schon einen Wunschnamen hinterlegt
 * (localStorage, z. B. wegen E-Mail-Bestätigung dazwischen), wird er erst
 * still versucht — der Dialog erscheint nur, wenn noch etwas zu tun ist.
 * Bei Netzfehlern beim Laden bleibt der Dialog weg (kein Aussperren).
 */
const PENDING_KEY = "clearn.pendingDisplayName";

export function DisplayNamePrompt() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const profile = await getProfile();
        if (!active || profile.displayName) return;

        const pending = window.localStorage.getItem(PENDING_KEY);
        if (pending) {
          try {
            await updateDisplayName(pending);
            window.localStorage.removeItem(PENDING_KEY);
            return; // still gespeichert — kein Dialog nötig
          } catch {
            if (!active) return;
            setName(pending); // Wunschname war nicht ok — vorbefüllt nachfragen
          }
        }
        if (active) setOpen(true);
      } catch {
        // Profil nicht ladbar (Netz): lieber nicht blockieren.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!open) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await updateDisplayName(name);
      window.localStorage.removeItem(PENDING_KEY);
      setOpen(false);
      // Seiten, die den Namen zeigen (Rangliste, Profil), laden ihn beim
      // nächsten Besuch selbst — kein globaler Reload nötig.
    } catch (err) {
      setError(displayNameErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dnp-title">
      <div className="modal">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="pf-ic pf-ic--indigo" aria-hidden>
            <User size={18} />
          </span>
          <h3 id="dnp-title">Wie sollen wir dich nennen?</h3>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Dein Name erscheint in der Rangliste und bei deinen Freunden. Du kannst ihn später im
          Profil ändern.
        </p>
        <form onSubmit={handleSave} style={{ display: "grid", gap: 12 }}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dein Name"
            maxLength={20}
            autoFocus
            disabled={busy}
            aria-label="Dein Name"
          />
          {error && (
            <div className="form-error" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}
          <div className="modal__actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
              {busy ? "Wird gespeichert…" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Merkt sich den Wunschnamen aus der Registrierung bis zur ersten Anmeldung. */
export function rememberPendingDisplayName(name: string) {
  try {
    window.localStorage.setItem(PENDING_KEY, name);
  } catch {
    // localStorage gesperrt (Privatmodus): dann fragt der Dialog einfach.
  }
}
