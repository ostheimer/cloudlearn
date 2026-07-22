"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, type OAuthProvider } from "./auth-context";
import { rememberPendingDisplayName } from "./display-name-prompt";
import {
  getAuthProviderAvailability,
  type AuthProviderAvailability,
} from "@/lib/auth-availability";
import { GraduationCap, MailCheck, AlertTriangle } from "@/components/icons";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { status, signIn, signUp, signInWithOAuth } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [providers, setProviders] = useState<AuthProviderAvailability>({
    email: true,
    google: false,
    apple: false,
  });

  // Already signed in? Skip the form.
  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard/home");
  }, [status, router]);

  useEffect(() => {
    let active = true;
    getAuthProviderAvailability().then((p) => {
      if (active) setProviders(p);
    });
    return () => {
      active = false;
    };
  }, []);

  const isLogin = mode === "login";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isLogin && name.trim().length < 2) {
      setError("Bitte gib deinen Namen ein (mindestens 2 Zeichen).");
      return;
    }
    if (!email.trim() || !password) {
      setError("Bitte E-Mail und Passwort eingeben.");
      return;
    }
    if (!isLogin && password.length < 6) {
      setError("Das Passwort muss mindestens 6 Zeichen haben.");
      return;
    }
    setBusy(true);
    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error);
          return;
        }
        router.replace("/dashboard/home");
      } else {
        const { error, requiresEmailConfirmation } = await signUp(email, password);
        if (error) {
          setError(error);
          return;
        }
        // Der Wunschname wird nach der ersten Anmeldung gespeichert — geprüft
        // vom Server. Lehnt er ihn ab, fragt der Dialog im Dashboard nach.
        rememberPendingDisplayName(name.trim());
        if (requiresEmailConfirmation) {
          setConfirmSent(true);
          return;
        }
        router.replace("/dashboard/home");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    setError(null);
    setBusy(true);
    const { error } = await signInWithOAuth(provider);
    if (error) {
      setError(error);
      setBusy(false);
    }
    // On success the browser redirects to the provider; nothing else to do.
  }

  if (confirmSent) {
    return (
      <div className="auth-card">
        <div className="auth-head">
          <div style={{ color: "var(--brand-600)" }}>
            <MailCheck size={48} />
          </div>
          <h1 className="h3">Fast geschafft!</h1>
        </div>
        <p className="muted center">
          Wir haben dir eine Bestätigungs-E-Mail an <strong>{email}</strong> geschickt. Klicke
          den Link darin, um dein Konto zu aktivieren — danach bist du automatisch angemeldet.
        </p>
        <Link href="/login" className="btn btn-ghost btn-block">
          Zurück zur Anmeldung
        </Link>
      </div>
    );
  }

  const hasSocial = providers.google || providers.apple;

  return (
    <div className="auth-card">
      <div className="auth-head">
        <Link href="/" className="brand">
          <span className="brand__mark" aria-hidden>
            <GraduationCap size={20} />
          </span>
          clearn.ai
        </Link>
        <h1 className="h3">{isLogin ? "Willkommen zurück" : "Konto erstellen"}</h1>
        <p className="muted" style={{ fontSize: "0.95rem" }}>
          {isLogin
            ? "Melde dich an, um deine Decks zu verwalten und zu lernen."
            : "Kostenlos starten — Decks anlegen, importieren und lernen."}
        </p>
      </div>

      {hasSocial && (
        <>
          <div style={{ display: "grid", gap: 10 }}>
            {providers.google && (
              <button
                type="button"
                className="social-btn"
                onClick={() => handleOAuth("google")}
                disabled={busy}
              >
                Mit Google fortfahren
              </button>
            )}
            {providers.apple && (
              <button
                type="button"
                className="social-btn"
                onClick={() => handleOAuth("apple")}
                disabled={busy}
              >
                Mit Apple fortfahren
              </button>
            )}
          </div>
          <div className="divider">oder mit E-Mail</div>
        </>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }} noValidate>
        {!isLogin && (
          <div className="field">
            <label htmlFor="name">Dein Name</label>
            <input
              id="name"
              type="text"
              className="input"
              autoComplete="nickname"
              placeholder="So sehen dich andere Lernende"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              disabled={busy}
              required
            />
          </div>
        )}
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
        <div className="field">
          <label htmlFor="password">Passwort</label>
          <input
            id="password"
            type="password"
            className="input"
            autoComplete={isLogin ? "current-password" : "new-password"}
            placeholder={isLogin ? "Dein Passwort" : "Mindestens 6 Zeichen"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {busy ? "Bitte warten…" : isLogin ? "Anmelden" : "Konto erstellen"}
        </button>
      </form>

      {isLogin && (
        <div className="center">
          <Link href="/forgot-password" className="link-muted">
            Passwort vergessen?
          </Link>
        </div>
      )}

      <div className="auth-alt">
        {isLogin ? (
          <>
            Noch kein Konto? <Link href="/signup">Registrieren</Link>
          </>
        ) : (
          <>
            Schon ein Konto? <Link href="/login">Anmelden</Link>
          </>
        )}
      </div>
    </div>
  );
}
