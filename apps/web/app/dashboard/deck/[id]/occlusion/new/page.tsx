"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { createCard, deleteCard, isApiError } from "@/lib/api";
import { getSupabase } from "@/lib/supabase-browser";
import { ArrowLeft, ImageIcon, X, Trash, Check, AlertTriangle } from "@/components/icons";

const BUCKET = "card-images";

// Vom Bucket erlaubte Bildtypen → Dateiendung für den Speicherpfad.
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

type Region = { x: number; y: number; w: number; h: number; label: string };

export default function OcclusionEditorPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const router = useRouter();
  const { userId } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [draw, setDraw] = useState<{ sx: number; sy: number; x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);

  function pickImage(f: File) {
    setFile(f);
    setImageSrc(URL.createObjectURL(f));
    setRegions([]);
    setError(null);
  }

  // Blob-URL wieder freigeben, sobald ein anderes Bild gewählt wird oder die
  // Seite verlassen wird — sonst leckt jede Auswahl eine Objekt-URL.
  useEffect(() => {
    if (!imageSrc) return;
    return () => URL.revokeObjectURL(imageSrc);
  }, [imageSrc]);

  function pct(e: React.PointerEvent) {
    const r = stageRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  function onDown(e: React.PointerEvent) {
    if (!imageSrc) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = pct(e);
    setDraw({ sx: p.x, sy: p.y, x: p.x, y: p.y });
  }
  function onMove(e: React.PointerEvent) {
    if (!draw) return;
    const p = pct(e);
    setDraw({ ...draw, x: p.x, y: p.y });
  }
  function onUp() {
    if (!draw) return;
    const x = Math.min(draw.sx, draw.x);
    const y = Math.min(draw.sy, draw.y);
    const w = Math.abs(draw.x - draw.sx);
    const h = Math.abs(draw.y - draw.sy);
    setDraw(null);
    if (w > 0.04 && h > 0.04) {
      setRegions((prev) => [...prev, { x, y, w, h, label: `Bereich ${prev.length + 1}` }]);
    }
  }

  const removeRegion = (i: number) => setRegions((prev) => prev.filter((_, j) => j !== i));
  const setLabel = (i: number, label: string) =>
    setRegions((prev) => prev.map((r, j) => (j === i ? { ...r, label } : r)));

  async function save() {
    if (!userId || !file || regions.length === 0 || saving) return;
    setSaving(true);
    setError(null);

    const supabase = getSupabase();
    // Endung möglichst aus dem MIME-Typ ableiten (zuverlässiger als der
    // Dateiname, der auch ganz ohne Punkt kommen kann).
    const ext =
      EXT_BY_MIME[file.type] ??
      (file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "jpg");
    const path = `${userId}/${deckId}/${crypto.randomUUID()}.${ext}`;
    const createdIds: string[] = [];

    try {
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(`Bild-Upload fehlgeschlagen: ${upErr.message}`);

      // Eine Karte pro Bereich — jede verdeckt genau ihren Bereich.
      const clean: Region[] = regions.map((r, i) => ({ ...r, label: r.label.trim() || `Bereich ${i + 1}` }));
      for (let i = 0; i < clean.length; i++) {
        const { card } = await createCard(userId, deckId, {
          front: "Bild-Occlusion: Was ist an der markierten Stelle?",
          back: clean[i]!.label,
          type: "occlusion",
          sourceImageUrl: path,
          extraData: { regions: clean, hideIndex: i },
        });
        createdIds.push(card.id);
      }
      router.push(`/dashboard/deck/${deckId}`);
    } catch (e) {
      // Teil-Erfolg zurückrollen: bereits erstellte Karten und das hochgeladene
      // Bild wieder entfernen, damit ein erneuter Versuch sauber startet — sonst
      // entstünden Duplikate und ein verwaistes Bild im Speicher.
      if (createdIds.length > 0) {
        await Promise.allSettled(createdIds.map((id) => deleteCard(id)));
      }
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      if (isApiError(e) && e.status === 402) {
        // Occlusion ist serverseitig eine Pro-Funktion (402/PAYWALL_REQUIRED).
        // Die rohe englische Server-Meldung wäre hier eine Sackgasse: das Web
        // hat gar keinen Kaufweg (#368), gekauft wird nur in der App — also
        // sagen wir genau das, statt „Upgrade to unlock it." ins Leere (#364).
        setError("Bild-Occlusion ist eine Pro-Funktion — Pro gibt es in der clearn-App.");
      } else {
        setError(isApiError(e) ? e.message : e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      }
      setSaving(false);
    }
  }

  const drawBox = draw
    ? {
        left: `${Math.min(draw.sx, draw.x) * 100}%`,
        top: `${Math.min(draw.sy, draw.y) * 100}%`,
        width: `${Math.abs(draw.x - draw.sx) * 100}%`,
        height: `${Math.abs(draw.y - draw.sy) * 100}%`,
      }
    : null;

  return (
    <div className="study-wrap">
      <Link href={`/dashboard/deck/${deckId}`} className="crumb">
        <ArrowLeft size={16} /> Zurück zum Deck
      </Link>

      <div className="cl-intro" style={{ marginBottom: 8 }}>
        <span
          className="cl-intro__ic"
          aria-hidden
          style={{ background: "rgba(5,150,105,0.14)", color: "#059669" }}
        >
          <ImageIcon size={28} />
        </span>
        <h1 className="h2">Occlusion-Karten</h1>
        <p className="muted">Bild wählen, Kästchen über Teile ziehen, beschriften</p>
      </div>

      <div className="occ-tools">
        <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
          {imageSrc ? "Anderes Bild" : "Bild wählen"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickImage(f);
            }}
          />
        </label>
        {regions.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => setRegions([])}>
            Bereiche löschen
          </button>
        )}
      </div>

      {!imageSrc ? (
        <div className="occ-drop">
          <ImageIcon size={30} />
          <p>Wähle ein Bild (Diagramm, Skizze, Landkarte …), um zu starten.</p>
        </div>
      ) : (
        <>
          <div
            className="occ-stage"
            ref={stageRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc} alt="Occlusion-Vorlage" draggable={false} />
            {regions.map((r, i) => (
              <div
                key={i}
                className="occ-rg"
                style={{
                  left: `${r.x * 100}%`,
                  top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`,
                  height: `${r.h * 100}%`,
                }}
              >
                <span>{r.label}</span>
                <button
                  type="button"
                  className="occ-rg__del"
                  aria-label="Bereich entfernen"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeRegion(i)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {drawBox && <div className="occ-draw" style={drawBox} />}
          </div>
          <p className="occ-hint">
            {regions.length > 0
              ? `${regions.length} ${regions.length === 1 ? "Bereich" : "Bereiche"} markiert — beschrifte sie unten.`
              : "Ziehe mit gedrückter Maustaste ein Kästchen über einen Bildteil."}
          </p>

          {regions.length > 0 && (
            <div className="occ-list">
              {regions.map((r, i) => (
                <div className="occ-item" key={i}>
                  <span className="occ-item__n">{i + 1}</span>
                  <input
                    className="occ-item__in"
                    value={r.label}
                    placeholder="Beschriftung"
                    onChange={(e) => setLabel(i, e.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Entfernen"
                    onClick={() => removeRegion(i)}
                  >
                    <Trash size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {error && (
        <div className="form-error" role="alert" style={{ marginTop: 14 }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-lg btn-block"
        style={{ marginTop: 16 }}
        disabled={!imageSrc || regions.length === 0 || saving}
        onClick={save}
      >
        {saving ? (
          "Wird gespeichert…"
        ) : (
          <>
            <Check size={18} /> {regions.length || ""} Occlusion-
            {regions.length === 1 ? "Karte" : "Karten"} erstellen
          </>
        )}
      </button>
    </div>
  );
}
