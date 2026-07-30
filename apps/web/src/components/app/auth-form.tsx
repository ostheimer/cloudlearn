"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, type OAuthProvider } from "./auth-context";
import { rememberPendingDisplayName, rememberPendingGender } from "./display-name-prompt";
import type { Gender } from "@/lib/api";
import {
  getAuthProviderAvailability,
  type AuthProviderAvailability,
} from "@/lib/auth-availability";
import { GraduationCap, MailCheck, AlertTriangle } from "@/components/icons";

// „Sag ich nicht" seit #609 (Laras Entscheidung): Pflichtfeld bleibt, aber
// niemand muss etwas Persönliches preisgeben. Steht als vierte Option in einer
// eigenen Zeile, weil die Beschriftung deutlich länger ist als die drei
// anderen — zu viert nebeneinander wäre es am Handy gequetscht.
const GENDER_OPTIONS: { value: Gender; label: string; wide?: boolean }[] = [
  { value: "female", label: "Weiblich" },
  { value: "male", label: "Männlich" },
  { value: "diverse", label: "Divers" },
  { value: "prefer_not_to_say", label: "Sag ich nicht", wide: true },
];

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { status, signIn, signUp, signInWithOAuth } = useAuth();

  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
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
    if (!isLogin && !gender) {
      setError("Bitte wähle aus, wie clearn dich nennen soll.");
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
        if (gender) rememberPendingGender(gender);
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
    // Google/Apple auf der Registrierungsseite dürfen die beiden Pflichtfelder
    // nicht umgehen. Beim Login bleiben sie wie bisher ohne Profilabfrage.
    if (!isLogin && name.trim().length < 2) {
      setError("Bitte gib deinen Namen ein (mindestens 2 Zeichen).");
      return;
    }
    if (!isLogin && !gender) {
      setError("Bitte wähle aus, wie clearn dich nennen soll.");
      return;
    }
    if (!isLogin) {
      // Nach dem Provider-Redirect speichert DisplayNamePrompt beide Angaben
      // über den geprüften Profil-Endpunkt. Das muss vor dem Redirect passieren.
      rememberPendingDisplayName(name.trim());
      rememberPendingGender(gender!);
    }
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
        {!isLogin && (
          <div className="field">
            <label id="gender-label">Geschlecht</label>
            <div className="seg seg--wrap" role="group" aria-labelledby="gender-label">
              {GENDER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`seg__btn${opt.wide ? " seg__btn--row" : ""}${
                    gender === opt.value ? " is-on" : ""
                  }`}
                  aria-pressed={gender === opt.value}
                  onClick={() => setGender(opt.value)}
                  disabled={busy}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              Damit dich clearn bei Freunden richtig nennt.
            </span>
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

      {/* Datenschutz und Impressum direkt am Formular (#609): Wer ein Konto
          anlegt, soll vorher nachlesen können, was mit seinen Daten passiert —
          bisher standen die Links nur im Profil, also erst NACH der Anmeldung. */}
      <div className="auth-legal">
        <Link href="/privacy">Datenschutz</Link>
        <span aria-hidden>·</span>
        <Link href="/impressum">Impressum</Link>
      </div>
    </div>
  );
}
