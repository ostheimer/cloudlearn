"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase-browser";
import { toGermanAuthError } from "@/lib/auth-errors";
import { AlertTriangle } from "@/components/icons";

/**
 * Landing point for OAuth and e-mail-confirmation redirects. The Supabase
 * client (detectSessionInUrl) exchanges the code for a session on load; we
 * then forward to the dashboard, or surface a friendly error.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();

    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const get = (key: string) => query.get(key) ?? hash.get(key);

    if (get("error") || get("error_code")) {
      // Supabase liefert die Beschreibung englisch ("Email link is invalid or
      // has expired") — durch die vorhandene Übersetzung schicken (#609).
      setError(toGermanAuthError(get("error_description")));
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      router.replace("/dashboard/home");
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish();
    });

    const timeout = window.setTimeout(() => {
      if (!done) {
        setError(
          "Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut."
        );
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [router]);

  return (
    <div className="auth-wrap">
      <div className="auth-card center">
        {error ? (
          <>
            <div style={{ color: "#dc2626" }}>
              <AlertTriangle size={48} />
            </div>
            <h1 className="h3">Anmeldung fehlgeschlagen</h1>
            <p className="muted">{error}</p>
            <Link href="/login" className="btn btn-primary btn-block">
              Zur Anmeldung
            </Link>
          </>
        ) : (
          <>
            <div className="spinner" style={{ margin: "10px auto 0" }} />
            <p className="muted">Anmeldung wird abgeschlossen…</p>
          </>
        )}
      </div>
    </div>
  );
}
