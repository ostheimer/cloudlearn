"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { GraduationCap, MailCheck, AlertTriangle } from "@/components/icons";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Bitte gib deine E-Mail-Adresse ein.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await resetPassword(email);
      if (error) setError(error);
      else setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="auth-card">
        <div className="auth-head">
          <div style={{ color: "var(--brand-600)" }}>
            <MailCheck size={48} />
          </div>
          <h1 className="h3">E-Mail unterwegs</h1>
        </div>
        <p className="muted center">
          Falls ein Konto zu <strong>{email}</strong> existiert, haben wir dir einen Link zum
          Zurücksetzen des Passworts geschickt.
        </p>
        <Link href="/login" className="btn btn-ghost btn-block">
          Zurück zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <div className="auth-head">
        <Link href="/" className="brand">
          <span className="brand__mark" aria-hidden>
            <GraduationCap size={20} />
          </span>
          clearn.ai
        </Link>
        <h1 className="h3">Passwort zurücksetzen</h1>
        <p className="muted" style={{ fontSize: "0.95rem" }}>
          Gib deine E-Mail ein — wir schicken dir einen Link zum Zurücksetzen.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }} noValidate>
        <div className="field">
          <label htmlFor="email">E-Mail</label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            placeholder="du@beispiel.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
            required
          />
        </div>

        {error && (
          <div className="form-error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Bitte warten…" : "Link senden"}
        </button>
      </form>

      <div className="auth-alt">
        <Link href="/login">Zurück zur Anmeldung</Link>
      </div>
    </div>
  );
}
