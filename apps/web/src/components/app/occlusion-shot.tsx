"use client";

import { useId } from "react";
import type { CardImage, OcclusionRegion } from "@/lib/card-images";

/**
 * Bild einer Bild-Karte mit hervorgehobener Stelle: der Rest wird abgedunkelt,
 * die abgefragte Stelle bekommt einen Rahmen. Ohne das sehen alle Karten zu
 * einem Bild identisch aus, denn sie unterscheiden sich nur in der Stelle.
 *
 * Gezeichnet wird als SVG, weil Bild und Markierung dann dasselbe
 * Koordinatensystem teilen: die viewBox trägt das echte Seitenverhältnis, also
 * sitzt die Markierung in jeder Größe richtig — vom 64px-Vorschaubild bis zur
 * großen Ansicht im Lösch-Dialog. Mit <img> + CSS-Overlay wäre sie verschoben,
 * sobald object-fit das Bild beschneidet oder einpasst.
 */
export function OcclusionShot({
  img,
  region,
  className,
}: {
  img: CardImage;
  region: OcclusionRegion | null;
  className?: string;
}) {
  // useId liefert IDs mit Doppelpunkten — die sind in url(#…) nicht erlaubt.
  const maskId = `occ${useId().replace(/:/g, "")}`;
  const W = 100 * img.aspect;
  const stroke = Math.max(0.7, W / 90);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} 100`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {region && (
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width={W} height="100" fill="#fff" />
            <rect
              x={region.x * W}
              y={region.y * 100}
              width={region.w * W}
              height={region.h * 100}
              rx="1"
              fill="#000"
            />
          </mask>
        </defs>
      )}
      {/* Kein Verzerren: die viewBox hat exakt das Seitenverhältnis des Bildes. */}
      <image href={img.url} x="0" y="0" width={W} height="100" preserveAspectRatio="none" />
      {region && (
        <>
          <rect
            x="0"
            y="0"
            width={W}
            height="100"
            fill="rgba(15, 23, 42, 0.55)"
            mask={`url(#${maskId})`}
          />
          <rect
            x={region.x * W}
            y={region.y * 100}
            width={region.w * W}
            height={region.h * 100}
            rx="1"
            fill="none"
            stroke="var(--amber)"
            strokeWidth={stroke}
          />
        </>
      )}
    </svg>
  );
}
