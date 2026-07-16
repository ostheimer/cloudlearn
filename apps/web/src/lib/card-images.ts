import { getSupabase } from "@/lib/supabase-browser";
import type { Card } from "@/lib/api";

/**
 * Bilder von Bild-Karten (Occlusion) liegen in einem PRIVATEN Bucket; die
 * Storage-Policy erlaubt nur Pfade, die mit der eigenen user id beginnen.
 * Es gibt daher keine dauerhafte URL — der eingeloggte Browser-Client stellt
 * sich pro Bild eine befristete („signierte") aus.
 */
export const CARD_IMAGE_BUCKET = "card-images";

export type OcclusionRegion = { x: number; y: number; w: number; h: number; label?: string };

/** Bild-URL plus Seitenverhältnis (Breite/Höhe). */
export type CardImage = { url: string; aspect: number };

const FALLBACK_ASPECT = 4 / 3;

function isRegion(r: unknown): r is OcclusionRegion {
  const c = r as OcclusionRegion | undefined;
  if (!c) return false;
  return [c.x, c.y, c.w, c.h].every((n) => typeof n === "number" && Number.isFinite(n));
}

function parseRegions(card: Card): { regions: OcclusionRegion[]; hideIndex: number } | null {
  const ed = card.extraData as { regions?: unknown; hideIndex?: unknown } | undefined;
  if (!Array.isArray(ed?.regions)) return null;
  const hideIndex = typeof ed?.hideIndex === "number" ? ed.hideIndex : 0;
  return { regions: ed.regions as OcclusionRegion[], hideIndex };
}

/**
 * Die eine Stelle, die genau diese Karte abfragt. Jede Occlusion-Karte trägt
 * die volle Regionsliste des Bildes und zeigt per hideIndex auf ihre eigene —
 * nur damit lassen sich die Karten zu einem Bild auseinanderhalten.
 */
export function occlusionTarget(card: Card): OcclusionRegion | null {
  const parsed = parseRegions(card);
  const target = parsed?.regions[parsed.hideIndex];
  return isRegion(target) ? target : null;
}

// Ohne die echten Maße säße eine Regions-Markierung falsch, sobald das Bild
// nicht quadratisch ist: die Koordinaten sind Anteile des BILDES, nicht des
// Rahmens, in den es gezeichnet wird.
function measureAspect(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () =>
      resolve(
        img.naturalWidth > 0 && img.naturalHeight > 0
          ? img.naturalWidth / img.naturalHeight
          : FALLBACK_ASPECT
      );
    img.onerror = () => resolve(FALLBACK_ASPECT);
    img.src = url;
  });
}

/**
 * Holt zu Storage-Pfaden signierte URLs (eine Stunde gültig) und misst das
 * Seitenverhältnis mit. Pfade werden dedupliziert — mehrere Karten teilen
 * sich in der Regel ein Bild. Ein Fehler ergibt null für diesen einen Pfad
 * statt eines Wurfs: ein kaputtes Bild darf die Kartenliste nicht mitreißen.
 */
export async function getCardImages(
  paths: string[],
  expiresInSeconds = 3600
): Promise<Record<string, CardImage | null>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const supabase = getSupabase();
  const entries = await Promise.all(
    unique.map(async (path) => {
      try {
        // Das Feld heißt sourceImageUrl, enthält aber einen Storage-Pfad.
        // Fremde http-Werte werden bewusst NICHT geladen: das Feld ist nur
        // `string` (kein Format erzwungen), auch KI-erzeugte Karten schreiben
        // hinein — eine externe URL würde beim Öffnen des Decks den fremden
        // Server anpingen. Nicht-Pfade ergeben den Platzhalter.
        const { data } = await supabase.storage
          .from(CARD_IMAGE_BUCKET)
          .createSignedUrl(path, expiresInSeconds);
        const url = data?.signedUrl ?? null;
        if (!url) return [path, null] as const;
        return [path, { url, aspect: await measureAspect(url) }] as const;
      } catch {
        return [path, null] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}
