"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { LearnSession } from "@/components/app/learn-session";
import {
  listDecksInFolder,
  listCardsInFolder,
  getDueCards,
  isApiError,
  type Card,
} from "@/lib/api";
import { Layers, AlertTriangle } from "@/components/icons";

/**
 * Learn every deck in one folder as a single session.
 *
 * ?mode=due  — only what spaced repetition says is due today (the default)
 * ?mode=all  — every card in the folder, for cramming before a test
 *
 * Unlike the app (issue #282), this page owns its card list: it loads the
 * folder's cards itself and hands the finished pool to LearnSession. The app
 * pre-fills a shared store and pushes to the global learn tab, which reloads
 * globally and silently replaces the selection with due cards from OTHER decks.
 */
export default function FolderLearnPage() {
  const params = useParams<{ id: string }>();
  const folderId = params.id;
  const search = useSearchParams();
  const mode = search.get("mode") === "all" ? "all" : "due";
  const { userId } = useAuth();

  const [pool, setPool] = useState<Card[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !folderId) return;
    try {
      let cards: Card[];
      if (mode === "all") {
        // Eine Anfrage für den ganzen Ordner (#612): vorher lief eine pro Deck,
        // bei 20 Decks also 20 Anfragen, von denen der Browser nur wenige
        // gleichzeitig laufen lässt. Der Server blättert intern über die
        // 1000-Zeilen-Grenze hinweg und behält die Deck-Reihenfolge.
        const { cards: inFolder } = await listCardsInFolder(folderId);
        cards = inFolder;
      } else {
        // getDueCards is global; keep only what belongs to this folder.
        const { decks } = await listDecksInFolder(folderId);
        const deckIds = new Set(decks.map((d) => d.id));
        const { cards: due } = await getDueCards(userId);
        cards = due.filter((c) => deckIds.has(c.deckId));
      }

      // Bild-Occlusion-Karten gehören nur in den Occlusion-Modus (kein Bild hier).
      setPool(cards.filter((c) => c.type !== "occlusion"));
      setError(null);
    } catch (e) {
      if (isApiError(e) && e.status === 404) setNotFound(true);
      else setError(isApiError(e) ? e.message : "Karten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [folderId, userId, mode]);

  useEffect(() => {
    load();
  }, [load]);

  const backHref = `/dashboard/folder/${folderId}`;

  if (loading) return <div className="spinner" />;

  if (notFound) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <AlertTriangle size={30} />
        </div>
        <h3>Ordner nicht gefunden</h3>
        <p>Dieser Ordner existiert nicht mehr.</p>
        <Link href="/dashboard" className="btn btn-primary">
          Zur Bibliothek
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <AlertTriangle size={30} />
        </div>
        <h3>Konnte nicht laden</h3>
        <p>{error}</p>
        <Link href={backHref} className="btn btn-primary">
          Zurück zum Ordner
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
        <h3>{mode === "due" ? "Heute ist hier nichts dran" : "Keine Karten zum Lernen"}</h3>
        <p>
          {mode === "due"
            ? "In diesem Ordner ist gerade keine Karte fällig. Du kannst trotzdem alle Karten durchgehen."
            : "Die Decks in diesem Ordner haben noch keine Karten."}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {mode === "due" && (
            <Link href={`${backHref}/learn?mode=all`} className="btn btn-primary">
              Alle Karten lernen
            </Link>
          )}
          <Link href={backHref} className={mode === "due" ? "btn btn-ghost" : "btn btn-primary"}>
            Zurück zum Ordner
          </Link>
        </div>
      </div>
    );
  }

  return <LearnSession pool={pool} backHref={backHref} backLabel="Zurück zum Ordner" />;
}
