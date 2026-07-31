"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/app/auth-context";
import {
  importSharedDeck,
  isApiError,
  previewSharedDeckSync,
  syncSharedDeck,
  type SharedDeckSyncPreview,
} from "@/lib/api";

function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  if (/iphone|ipod|android/i.test(ua)) return true;
  // iPadOS 13+ reports as "Macintosh" but has touch points
  return /ipad/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

const buttonBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  borderRadius: 14,
  padding: "14px 18px",
  fontWeight: 800,
  fontSize: 16,
  border: "1px solid transparent",
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

/**
 * Ein geteiltes Deck im Browser übernehmen (#708).
 *
 * Bis hierher war ein geteilter Link am Rechner eine Sackgasse: Vorschau
 * ansehen und sonst nichts. Nur am Handy gab es einen Sprung in die App — wer
 * clearn im Browser benutzt (Laras Alltag), kam mit dem Link nicht weiter.
 *
 * Zuschnitt: Der Knopf ist für ALLE sichtbar, auch ohne Anmeldung; darunter
 * steht ehrlich, dass es dafür ein Konto braucht. Wer nicht angemeldet ist,
 * landet auf der Anmeldung und danach WIEDER HIER (`?next=`), nicht auf der
 * Startseite.
 *
 * Liegt schon eine eigene Kopie vor, kommen dieselben zwei Wege wie in der App
 * (#614): „N neue Karten übernehmen" und daneben „Trotzdem nochmal übernehmen".
 * Ein echtes Ersetzen gibt es bewusst nicht — es würde Lernfortschritt und
 * eigene Änderungen wegwerfen.
 *
 * Diese Seite liegt AUSSERHALB von /dashboard und /(account) — dort hängt kein
 * AuthProvider im Baum, und `useAuth` würde werfen. Deshalb bringt der Knopf
 * seinen eigenen mit; der Provider hält nur die Supabase-Sitzung, es entsteht
 * keine zweite Anmeldung.
 */
export function ImportInAppCta({ token }: { token: string }) {
  return (
    <AuthProvider>
      <ImportCta token={token} />
    </AuthProvider>
  );
}

function ImportCta({ token }: { token: string }) {
  const router = useRouter();
  const { status } = useAuth();
  const [mobile, setMobile] = useState<boolean | null>(null);
  const [sync, setSync] = useState<SharedDeckSyncPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMobile(isMobileDevice());
  }, []);

  const loggedIn = status === "authenticated";

  // Nur angemeldet nachsehen — die Antwort hängt am Konto. Scheitert die
  // Abfrage, bleibt `sync` auf `null`: dann verhält sich die Seite wie ohne
  // vorhandene Kopie, also ein Knopf, „Übernehmen".
  useEffect(() => {
    if (!loggedIn) return;
    let active = true;
    void previewSharedDeckSync(token)
      .then((res) => {
        if (active) setSync(res);
      })
      .catch(() => {
        if (active) setSync(null);
      });
    return () => {
      active = false;
    };
  }, [loggedIn, token]);

  const goToLogin = useCallback(() => {
    router.push(`/login?next=${encodeURIComponent(`/deck/${token}`)}`);
  }, [router, token]);

  const handleImport = async () => {
    if (busy) return;
    if (!loggedIn) return goToLogin();
    setBusy(true);
    setError(null);
    try {
      const { deck } = await importSharedDeck(token);
      router.push(`/dashboard/deck/${deck.id}`);
    } catch (e) {
      // An der Tarif-Grenze schickt der Server den Grund und den Ausweg mit
      // (#611) — den zeigen, statt ihn durch „hat nicht geklappt" zu ersetzen.
      setError(isApiError(e) ? e.message : "Übernehmen hat nicht funktioniert.");
      setBusy(false);
    }
  };

  const handleSync = async () => {
    if (busy || !sync?.existingDeck) return;
    setBusy(true);
    setError(null);
    try {
      const result = await syncSharedDeck(token);
      router.push(`/dashboard/deck/${result.deck.id}`);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Aktualisieren hat nicht funktioniert.");
      setBusy(false);
    }
  };

  const hasCopy = Boolean(sync?.existingDeck);
  const newCards = sync?.newCardCount ?? 0;
  const secondary = hasCopy && newCards > 0;

  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "center", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
        {secondary && (
          <button
            type="button"
            onClick={handleSync}
            disabled={busy}
            style={{
              ...buttonBase,
              background: "#f8fafc",
              color: "#0f172a",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {newCards === 1 ? "1 neue Karte übernehmen" : `${newCards} neue Karten übernehmen`}
          </button>
        )}

        <button
          type="button"
          onClick={handleImport}
          disabled={busy}
          style={{
            ...buttonBase,
            // Liegt schon eine Kopie vor, ist „nochmal übernehmen" der ZWEITE
            // Weg und tritt entsprechend zurück.
            background: secondary ? "rgba(255,255,255,0.08)" : "#f8fafc",
            color: secondary ? "#f8fafc" : "#0f172a",
            border: secondary ? "1px solid rgba(255,255,255,0.16)" : "1px solid transparent",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {hasCopy ? "Trotzdem nochmal übernehmen" : "In meine Bibliothek übernehmen"}
        </button>

        {/* Der Sprung in die App bleibt — am Handy ist er für alle, die clearn
            installiert haben, der kürzere Weg. Am Rechner löst clearn:// nicht
            auf, dort wäre es ein toter Knopf. */}
        {mobile && (
          <a
            href={`clearn://deck/share/${encodeURIComponent(token)}`}
            style={{
              ...buttonBase,
              background: "rgba(255,255,255,0.08)",
              color: "#f8fafc",
              border: "1px solid rgba(255,255,255,0.16)",
            }}
          >
            In der App öffnen
          </a>
        )}
      </div>

      {hasCopy && (
        <p style={{ margin: 0, color: "#dbe4ff", fontSize: 14, maxWidth: 520 }}>
          {newCards === 0
            ? `„${sync?.existingDeck?.title}" hast du schon — es gibt nichts Neues zu übernehmen.`
            : `„${sync?.existingDeck?.title}" hast du schon. Aktualisieren fügt nur hinzu, es löscht und überschreibt nichts.`}
        </p>
      )}

      {/* Ehrlich vorab statt Überraschung nach dem Klick. */}
      {!loggedIn && status !== "loading" && (
        <p style={{ margin: 0, color: "#dbe4ff", fontSize: 14, maxWidth: 520 }}>
          Zum Übernehmen brauchst du ein clearn-Konto — nach dem Anmelden landest du wieder hier.
        </p>
      )}

      {error && (
        <p style={{ margin: 0, color: "#fecaca", fontSize: 14, maxWidth: 520 }}>{error}</p>
      )}
    </div>
  );
}
