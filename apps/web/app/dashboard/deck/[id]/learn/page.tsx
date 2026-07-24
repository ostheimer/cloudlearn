"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LearnSession } from "@/components/app/learn-session";
import { listCardsInDeck, isApiError, type Card } from "@/lib/api";
import { Layers, AlertTriangle } from "@/components/icons";

export default function LearnPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;

  // Die volle Runde. Wird nach dem Laden einmal gesetzt, damit ihre Identität
  // für LearnSession stabil bleibt — „Alle nochmal" stellt genau sie wieder her.
  const [pool, setPool] = useState<Card[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!deckId) return;
    try {
      const { cards: c } = await listCardsInDeck(deckId);
      // Bild-Occlusion-Karten gehören nur in den Occlusion-Modus (kein Bild hier).
      const studyable = c.filter((x) => x.type !== "occlusion");
      // Gezieltes Üben: ?cards=id1,id2 beschränkt die Runde auf genau diese Karten
      // (z. B. „Wackelkandidaten üben" aus der Deck-Statistik). Fallback: alle.
      const cardsParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("cards")
          : null;
      const wanted = cardsParam ? new Set(cardsParam.split(",").filter(Boolean)) : null;
      const subset = wanted ? studyable.filter((x) => wanted.has(x.id)) : studyable;
      setPool(subset.length > 0 ? subset : studyable);
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Karten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [deckId]);

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
        <Link href={`/dashboard/deck/${deckId}`} className="btn btn-primary">
          Zurück zum Deck
        </Link>
      </div>
    );
  }

  if (!pool || pool.length === 0) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <Layers size={30} />
        </div>
        <h3>Keine Karten zum Lernen</h3>
        <p>Füge dem Deck zuerst ein paar Karten hinzu.</p>
        <Link href={`/dashboard/deck/${deckId}`} className="btn btn-primary">
          Karten hinzufügen
        </Link>
      </div>
    );
  }

  return (
    <LearnSession pool={pool} backHref={`/dashboard/deck/${deckId}`} backLabel="Zurück zum Deck" />
  );
}
