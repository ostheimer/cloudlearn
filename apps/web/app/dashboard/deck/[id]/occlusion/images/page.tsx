"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { listCardsInDeck } from "@/lib/api";
import { getCardImages, type CardImage } from "@/lib/card-images";
import { groupOcclusionImages, type OcclusionImageGroup } from "@/lib/occlusion-groups";
import { ArrowLeft, ImageIcon } from "@/components/icons";

export default function OcclusionImagesPage() {
  const { id: deckId } = useParams<{ id: string }>();
  const [groups, setGroups] = useState<OcclusionImageGroup[]>([]);
  const [images, setImages] = useState<Record<string, CardImage | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { cards } = await listCardsInDeck(deckId);
      const next = groupOcclusionImages(cards);
      setGroups(next);
      setImages(await getCardImages(next.map(g => g.path)));
    } catch (e) { setError(e instanceof Error ? e.message : "Bilder konnten nicht geladen werden."); }
    finally { setLoading(false); }
  }, [deckId]);
  useEffect(() => { void load(); }, [load]);
  return <div className="study-wrap">
    <Link href={`/dashboard/deck/${deckId}`} className="crumb"><ArrowLeft size={16} /> Zurück zum Deck</Link>
    <div className="cl-intro"><h1 className="h2">Deine Bilder</h1><p className="muted">Occlusion-Bilder und ihre Karten verwalten</p></div>
    <Link href={`/dashboard/deck/${deckId}/occlusion/new`} className="btn btn-primary"><ImageIcon size={16} /> Neues Bild</Link>
    {loading ? <div className="loading"><span className="spinner" /></div> : error ? <div role="alert"><p>{error}</p><button className="btn btn-ghost" onClick={() => void load()}>Erneut versuchen</button></div> : groups.length === 0 ? <div className="empty-state"><p>Dieses Deck hat noch keine Occlusion-Bilder.</p></div> :
      <div className="occ-gallery">{groups.map((group, i) => {
        const image = images[group.path];
        return <article className="occ-image-card" key={group.path}>
          {image ?
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.url} alt={`Occlusion-Bild ${i + 1}`} /> : <p className="muted">Bild nicht verfügbar</p>}
          <h2 className="h3">Bild {i + 1}</h2>
          <p className="muted">{group.regions.length} Bereiche · {group.cards.length} Karten</p>
          <ul>{group.cards.map(card => <li key={card.id}>{card.back}</li>)}</ul>
          {group.editable ? <Link href={`/dashboard/deck/${deckId}/occlusion/edit/${group.cards[0]!.id}`} className="btn btn-ghost">Bild bearbeiten</Link> : <p role="alert">Die gespeicherten Bereiche sind unvollständig und können nicht sicher bearbeitet werden.</p>}
        </article>;
      })}</div>}
  </div>;
}
