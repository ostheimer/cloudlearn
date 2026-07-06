"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/lib/site";

/**
 * Landing page of the Supabase e-mail confirmation redirect.
 * Supabase appends failures as URL params — in the hash fragment
 * (#error=…&error_code=…) or as query params — which only the browser
 * can read, hence a client component.
 */

type ConfirmResult =
  | { state: "checking" }
  | { state: "success" }
  | { state: "expired" }
  | { state: "failed"; description: string | null };

function parseAuthResult(): ConfirmResult {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const get = (key: string) => hash.get(key) ?? query.get(key);

  if (!get("error") && !get("error_code")) return { state: "success" };
  if (get("error_code") === "otp_expired") return { state: "expired" };
  return { state: "failed", description: get("error_description") };
}

function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  if (/iphone|ipod|android/i.test(ua)) return true;
  // iPads (auch iPadOS 13+, das sich als "Macintosh" meldet) haben Touch
  return /ipad/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

const appLinkStyle = {
  display: "inline-block",
  marginTop: "2rem",
  padding: "1rem 2rem",
  background: "#6366f1",
  color: "#fff",
  borderRadius: "12px",
  fontSize: "1.1rem",
  fontWeight: 700,
  textDecoration: "none",
} as const;

/**
 * clearn:// can only be opened by a phone with the app installed — on
 * desktop browsers the link would silently do nothing, so we show an
 * instruction instead of a dead button.
 */
function AppCta({ label }: { label: string }) {
  const [mobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    setMobile(isMobileDevice());
  }, []);

  if (mobile === null) return null;

  if (mobile) {
    return (
      <a href="clearn://" style={appLinkStyle}>
        {label}
      </a>
    );
  }

  return (
    <div
      style={{
        marginTop: "2rem",
        padding: "1rem 1.5rem",
        background: "#eef2ff",
        border: "1px solid #c7d2fe",
        borderRadius: "12px",
        color: "#3730a3",
        fontSize: "1rem",
        fontWeight: 600,
        maxWidth: "440px",
        lineHeight: 1.6,
      }}
    >
      📱 Weiter geht’s am Handy: Öffne dort die <strong>clearn</strong>-App und melde dich an.
    </div>
  );
}

export default function AuthConfirmPage() {
  const [result, setResult] = useState<ConfirmResult>({ state: "checking" });

  useEffect(() => {
    setResult(parseAuthResult());
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        background: "#f8f9fa",
      }}
    >
      {result.state === "checking" && (
        <p style={{ fontSize: "1.1rem", color: "#6b7280" }}>Bestätigung wird geprüft …</p>
      )}

      {result.state === "success" && (
        <>
          <div style={{ fontSize: "64px", marginBottom: "1rem" }}>✅</div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#111827", marginBottom: "0.5rem" }}>
            E-Mail bestätigt!
          </h1>
          <p style={{ fontSize: "1.1rem", color: "#6b7280", maxWidth: "400px", lineHeight: 1.6 }}>
            Dein Konto ist jetzt aktiv. Öffne die <strong>clearn</strong> App auf deinem Handy und
            melde dich an.
          </p>
          <AppCta label="🧠 Jetzt in der App anmelden" />
        </>
      )}

      {(result.state === "expired" || result.state === "failed") && (
        <>
          <div style={{ fontSize: "64px", marginBottom: "1rem" }}>⚠️</div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#111827", marginBottom: "0.5rem" }}>
            {result.state === "expired"
              ? "Dieser Bestätigungslink ist abgelaufen"
              : "Die Bestätigung hat nicht geklappt"}
          </h1>
          <p style={{ fontSize: "1.1rem", color: "#6b7280", maxWidth: "440px", lineHeight: 1.6 }}>
            {result.state === "expired"
              ? "Bestätigungslinks sind aus Sicherheitsgründen nur kurz gültig. Keine Sorge: Öffne die clearn-App und melde dich an — dort kannst du dir einen neuen Link zuschicken lassen."
              : "Der Link ist ungültig oder wurde schon verwendet. Öffne die clearn-App und melde dich an — falls dein Konto noch nicht bestätigt ist, kannst du dort einen neuen Link anfordern."}
          </p>
          <AppCta label="📱 clearn-App öffnen" />
          <p style={{ marginTop: "1.4rem", fontSize: "0.9rem", color: "#6b7280" }}>
            Klappt es nicht?{" "}
            <a href={siteConfig.supportMailto} style={{ color: "#4338ca", fontWeight: 600 }}>
              Schreib uns: {siteConfig.supportEmail}
            </a>
          </p>
          {result.state === "failed" && result.description && (
            <p style={{ marginTop: "0.6rem", fontSize: "0.75rem", color: "#9ca3af", maxWidth: "440px" }}>
              Technische Info: {result.description}
            </p>
          )}
        </>
      )}

      <p style={{ marginTop: "2rem", fontSize: "0.85rem", color: "#9ca3af" }}>
        clearn.ai — Foto → Flashcards → Wissen
      </p>
    </div>
  );
}
