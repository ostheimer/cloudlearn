"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase-browser";
import { toGermanAuthError } from "@/lib/auth-errors";

type Phase = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The recovery link establishes a session (detectSessionInUrl). Once present,
  // the user may set a new password.
  useEffect(() => {
    const supabase = getSupabase();
    let settled = false;
    const markReady = () => {
      if (settled) return;
      settled = true;
      setPhase("ready");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) markReady();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) markReady();
    });

    const timeout = window.setTimeout(() => {
      if (!settled) setPhase("invalid");
    }, 6000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Das Passwort muss mindestens 6 Zeichen haben.");
      return;
    }
    if (password !== confirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) {
        setError(toGermanAuthError(error.message));
        return;
      }
      setPhase("done");
      window.setTimeout(() => router.replace("/dashboard"), 1400);
    } finally {
      setBusy(false);
    }
  }

  if (phase === "checking") {
    return (
      <div className="auth-card center">
        <div className="spinner" style={{ margin: "10px auto 0" }} />
        <p className="muted">Link wird geprüft…</p>
      </div>
    );
  }

  if (phase === "invalid") {
    return (
      <div className="auth-card">
        <div className="auth-head">
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h1 className="h3">Link ungültig oder abgelaufen</h1>
        </div>
        <p className="muted center">
          Bitte fordere einen neuen Link zum Zurücksetzen an.
        </p>
        <Link href="/forgot-password" className="btn btn-primary btn-block">
          Neuen Link anfordern
        </Link>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="auth-card">
        <div className="auth-head">
          <div style={{ fontSize: 48 }}>✅</div>
          <h1 className="h3">Passwort geändert</h1>
        </div>
        <p className="muted center">Du wirst zu deiner Bibliothek weitergeleitet…</p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-head">
        <h1 className="h3">Neues Passwort setzen</h1>
        <p className="muted" style={{ fontSize: "0.95rem" }}>
          Wähle ein neues Passwort für dein Konto.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }} noValidate>
        <div className="field">
          <label htmlFor="password">Neues Passwort</label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete="new-password"
            placeholder="Mindestens 6 Zeichen"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="confirm">Passwort bestätigen</label>
          <input
            id="confirm"
            type="password"
            className="input"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
            required
          />
        </div>

        {error && (
          <div className="form-error" role="alert">
            <span aria-hidden>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Bitte warten…" : "Passwort speichern"}
        </button>
      </form>
    </div>
  );
}
