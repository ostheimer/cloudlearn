"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { LearnSession } from "@/components/app/learn-session";
import { getDueCards, isApiError, type Card } from "@/lib/api";
import { groupCardsByDeck } from "@/lib/group-by-deck";
import { CheckCircle, AlertTriangle } from "@/components/icons";

/**
 * Die globale fällige Runde vom "Jetzt lernen"-Knopf der Startseite (#609):
 * alles, was heute quer über alle Decks ansteht, in EINER Runde. Laras
 * Entscheidung gegen das Vermischen: die Karten laufen Deck für Deck
 * (groupCardsByDeck), und die LearnSession blendet den Deck-Namen klein auf
 * jeder Karte ein, sobald mehrere Decks im Stapel sind.
 *
 * Vorlage ist das Ordner-Lernen (folder/[id]/learn): die Seite besitzt ihre
 * Kartenliste selbst und übergibt den fertigen Stapel an die LearnSession.
 */
export default function GlobalLearnPage() {
  const { userId } = useAuth();

  const [pool, setPool] = useState<Card[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const { cards: due } = await getDueCards(userId);
      // Bild-Occlusion-Karten gehören nur in den Occlusion-Modus (kein Bild hier).
      setPool(groupCardsByDeck(due.filter((c) => c.type !== "occlusion")));
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Karten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="spinner" />;

  if (error) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <AlertTriangle size={30} />
        </div>
        <h3>Konnte nicht laden</h3>
        <p>{error}</p>
        <Link href="/dashboard/home" className="btn btn-primary">
          Zur Startseite
        </Link>
      </div>
    );
  }

  if (!pool || pool.length === 0) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <CheckCircle size={30} />
        </div>
        <h3>Nichts fällig — gut gemacht</h3>
        <p>Alle Wiederholungen für heute sind erledigt.</p>
        <Link href="/dashboard/home" className="btn btn-primary">
          Zur Startseite
        </Link>
      </div>
    );
  }

  return (
    <LearnSession pool={pool} backHref="/dashboard/home" backLabel="Zurück zur Startseite" />
  );
}
