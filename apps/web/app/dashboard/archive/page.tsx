"use client";

/**
 * Archiv (#614, Laras Auswahl aus Punkt 9).
 *
 * „Alt-Schuljahr raus, ohne es zu löschen." Archivierte Decks liegen hier,
 * fallen aus Bibliothek und Fällig-Stapel und kommen auf Knopfdruck zurück.
 *
 * Bewusst NICHT im Profil neben dem Papierkorb: Ein archiviertes Deck ist kein
 * Konto-Thema, sondern Teil der Bibliothek — man sucht es dort, nicht in den
 * Einstellungen. Der Einstieg steht deshalb unter der Deck-Liste.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { isApiError, listDecks, setDeckArchived, type Deck } from "@/lib/api";
import { deckCountLabel } from "@/lib/deck-count-label";
import { AlertTriangle, ArrowLeft, Layers, RotateCw } from "@/components/icons";

export default function ArchivePage() {
  const { userId } = useAuth();
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { decks: fetched } = await listDecks(userId, { archived: true });
      setDecks(fetched);
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Archiv konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/dashboard");
  };

  const restore = async (deck: Deck) => {
    setBusyId(deck.id);
    setNotice(null);
    try {
      await setDeckArchived(deck.id, false);
      setNotice(`„${deck.title}" ist wieder in deiner Bibliothek.`);
      await load();
    } catch (e) {
      setError(isApiError(e) ? e.message : "Zurückholen hat nicht funktioniert.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading && decks.length === 0 && !error) return <div className="spinner" />;

  return (
    <>
      <div className="lib-head">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <button
            type="button"
            onClick={goBack}
            aria-label="Zurück"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-2)",
              display: "inline-flex",
            }}
          >
            <ArrowLeft size={22} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1>Archiv</h1>
            <p className="muted" style={{ marginTop: 4 }}>
              Diese Decks sind aus der Bibliothek genommen — nichts ist gelöscht.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="panel" style={{ borderColor: "#dc2626", marginBottom: 14 }}>
          <p style={{ margin: 0, color: "#dc2626", display: "flex", gap: 8 }}>
            <AlertTriangle size={18} /> {error}
          </p>
        </div>
      )}

      {notice && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <p className="muted" style={{ margin: 0 }}>
            {notice}
          </p>
        </div>
      )}

      {decks.length === 0 ? (
        <div className="empty-state">
          <h3>Nichts im Archiv</h3>
          <p>
            Ein Deck, das du gerade nicht brauchst, kannst du archivieren: Es verschwindet aus der
            Bibliothek und aus dem Fällig-Stapel, bleibt aber vollständig erhalten.
          </p>
          <Link href="/dashboard" className="btn btn-primary">
            Zur Bibliothek
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
          {decks.map((deck) => (
            <div key={deck.id} className="panel" style={{ padding: "12px 14px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: 600,
                }}
                title={deck.title}
              >
                <Layers size={16} /> {deck.title}
              </div>
              <p className="muted" style={{ margin: "2px 0 10px", fontSize: "0.85rem" }}>
                {deckCountLabel(deck.cardCount ?? 0, deck.imageCardCount ?? 0) ?? "Keine Karten"}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: "8px 12px", fontSize: "0.85rem" }}
                disabled={busyId === deck.id}
                onClick={() => void restore(deck)}
              >
                <RotateCw size={16} /> Zurück in die Bibliothek
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
