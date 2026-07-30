"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { siteConfig } from "@/lib/site";
import { isMobileDevice } from "@/lib/device";
import { CheckCircle, AlertTriangle } from "@/components/icons";

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

const primaryCtaStyle = {
  display: "inline-block",
  padding: "1rem 2rem",
  background: "#6366f1",
  color: "#fff",
  borderRadius: "12px",
  fontSize: "1.1rem",
  fontWeight: 700,
  textDecoration: "none",
} as const;

const secondaryCtaStyle = {
  display: "inline-block",
  padding: "0.9rem 1.75rem",
  background: "#fff",
  color: "#4338ca",
  border: "1px solid #c7d2fe",
  borderRadius: "12px",
  fontSize: "1rem",
  fontWeight: 600,
  textDecoration: "none",
} as const;

/**
 * Beide Wege anbieten (#609): Diese Seite wird sowohl vom Handy (App-Konto)
 * als auch am Rechner geöffnet. Vorher stand hier nur „weiter am Handy" —
 * am Rechner war das eine Sackgasse, und für Konten, die im Browser
 * angelegt wurden, war es sogar falsch.
 *
 * clearn:// kann nur ein Handy mit installierter App öffnen, deshalb
 * erscheint der App-Knopf nur dort. Der Browser-Weg funktioniert überall
 * und steht daher von der ersten Bildschirmausgabe an — auch bevor die
 * Geräte-Erkennung (nur im Browser möglich) durch ist.
 */
function NextSteps({ browserLabel }: { browserLabel: string }) {
  const [mobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    setMobile(isMobileDevice());
  }, []);

  return (
    <div
      style={{
        marginTop: "2rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      {mobile ? (
        <>
          <a href="clearn://" style={primaryCtaStyle}>
            Jetzt in der App anmelden
          </a>
          <Link href="/login" style={secondaryCtaStyle}>
            {browserLabel}
          </Link>
        </>
      ) : (
        <>
          <Link href="/login" style={primaryCtaStyle}>
            {browserLabel}
          </Link>
          {mobile === false && (
            <p style={{ fontSize: "0.95rem", color: "#6b7280", maxWidth: "440px", lineHeight: 1.6 }}>
              Am Handy? Öffne dort die <strong>clearn</strong>-App und melde dich an.
            </p>
          )}
        </>
      )}
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
          <div style={{ marginBottom: "1rem", color: "#10b981" }}>
            <CheckCircle size={64} />
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#111827", marginBottom: "0.5rem" }}>
            E-Mail bestätigt
          </h1>
          <p style={{ fontSize: "1.1rem", color: "#6b7280", maxWidth: "420px", lineHeight: 1.6 }}>
            Dein Konto ist jetzt aktiv. Du kannst sofort hier im Browser weiterlernen — oder am
            Handy in der <strong>clearn</strong>-App.
          </p>
          <NextSteps browserLabel="Hier im Browser anmelden" />
        </>
      )}

      {(result.state === "expired" || result.state === "failed") && (
        <>
          <div style={{ marginBottom: "1rem", color: "#f59e0b" }}>
            <AlertTriangle size={64} />
          </div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "#111827", marginBottom: "0.5rem" }}>
            {result.state === "expired"
              ? "Dieser Bestätigungslink ist abgelaufen"
              : "Die Bestätigung hat nicht geklappt"}
          </h1>
          <p style={{ fontSize: "1.1rem", color: "#6b7280", maxWidth: "440px", lineHeight: 1.6 }}>
            {result.state === "expired"
              ? "Bestätigungslinks sind aus Sicherheitsgründen nur kurz gültig. Keine Sorge: Melde dich an — dann kannst du dir einen neuen Link zuschicken lassen."
              : "Der Link ist ungültig oder wurde schon verwendet. Melde dich an — falls dein Konto noch nicht bestätigt ist, kannst du dort einen neuen Link anfordern."}
          </p>
          <NextSteps browserLabel="Zur Anmeldung im Browser" />
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
