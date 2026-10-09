"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { Modal } from "@/components/app/modal";
import { createCard, deleteCard, editOcclusionImage, listCardsInDeck, isApiError, getLpBalance } from "@/lib/api";
import { getCardImages } from "@/lib/card-images";
import { groupOcclusionImages, type EditableRegion, type OcclusionImageGroup } from "@/lib/occlusion-groups";
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

type Region = EditableRegion;

// Ergebnis der Tarif-Abfrage beim Öffnen. "unknown" deckt beides ab: läuft noch
// UND fehlgeschlagen. Nur ein bestätigtes "free" sperrt — siehe proGate unten.
type ProGate = "unknown" | "free" | "pro";

export function OcclusionEditor({ sourceCardId }: { sourceCardId?: string }) {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const router = useRouter();
  const { userId } = useAuth();

  const [group, setGroup] = useState<OcclusionImageGroup | null>(null);
  const [loading, setLoading] = useState(!!sourceCardId);
  const [imageAspect, setImageAspect] = useState(4 / 3);
  const [redraw, setRedraw] = useState<number | null>(null);
  const initialRegionsRef = useRef<Region[]>([]);
  const savedRef = useRef(false);
  const isEditing = !!sourceCardId;
  const backHref = isEditing ? `/dashboard/deck/${deckId}/occlusion/images` : `/dashboard/deck/${deckId}`;
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [draw, setDraw] = useState<{ sx: number; sy: number; x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Occlusion ist serverseitig eine Pro-Funktion (#352). Bisher merkte man das
  // erst beim Speichern — nach Bild wählen und allen Kästchen (#364).
  const [proGate, setProGate] = useState<ProGate>("unknown");

  // Nachfrage vor Kästchen-Verlust (#608): „Zurück zum Deck", „Anderes Bild"
  // und „Bereiche löschen" warfen gezeichnete Kästchen kommentarlos weg.
  const [confirm, setConfirm] = useState<null | "leave" | "clear" | "newImage" | "save">(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dirty = isEditing ? JSON.stringify(regions) !== JSON.stringify(initialRegionsRef.current) : regions.length > 0;
  const retainedIds = new Set(regions.flatMap(r => r.cardIds));
  const removedCount = group?.cards.filter(c => !retainedIds.has(c.id)).length ?? 0;

  useEffect(() => {
    if (!sourceCardId) return;
    setLoading(true); setGroup(null); setError(null); savedRef.current = false;
    let active = true;
    (async () => {
      try {
        const { cards } = await listCardsInDeck(deckId);
        const found = groupOcclusionImages(cards).find(g => g.cards.some(c => c.id === sourceCardId));
        if (!found) throw new Error("Dieses Bild ist nicht mehr in diesem Deck vorhanden.");
        if (!found.editable) throw new Error("Die gespeicherten Bereiche sind unvollständig. Das Bild kann nicht sicher bearbeitet werden.");
        const images = await getCardImages([found.path]);
        const image = images[found.path];
        if (!image) throw new Error("Das Bild konnte nicht geladen werden. Versuche es erneut.");
        if (!active) return;
        initialRegionsRef.current = found.regions;
        setGroup(found); setRegions(found.regions); setImageSrc(image.url); setImageAspect(image.aspect);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Bild konnte nicht geladen werden.");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [deckId, sourceCardId]);

  // Tab schließen oder neu laden: nur der Browser kann hier noch warnen —
  // solange Kästchen gezeichnet und noch nicht gespeichert sind.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (savedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Tarif beim Öffnen abfragen — BEWUSST fail-open: nur ein bestätigtes "free"
  // sperrt. Fehler oder "läuft noch" bleiben "unknown" und lassen den Editor
  // normal arbeiten; jemanden auszusperren, der bezahlt hat, wäre schlimmer als
  // der bisherige Zustand. Durchgesetzt wird die Sperre ohnehin weiterhin
  // serverseitig (402 beim Speichern), es entweicht also nichts.
  // getLpBalance() ist der vorhandene Weg zum Tarif im Web — die Profil-Seite
  // liest ihn schon genauso (app/dashboard/profile/page.tsx).
  useEffect(() => {
    let cancelled = false;
    getLpBalance()
      .then((u) => {
        if (!cancelled) setProGate(u.tier === "free" ? "free" : "pro");
      })
      .catch(() => {
        if (!cancelled) setProGate("unknown");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function pickImage(f: File) {
    setFile(f);
    setImageSrc(URL.createObjectURL(f));
    setRegions([]);
    setError(null);
  }

  // Blob-URL wieder freigeben, sobald ein anderes Bild gewählt wird oder die
  // Seite verlassen wird — sonst leckt jede Auswahl eine Objekt-URL.
  useEffect(() => {
    if (!imageSrc?.startsWith("blob:")) return;
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
    if (!imageSrc || saving) return;
    e.currentTarget.setPointerCapture(e.pointerId);
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
      setRegions((prev) => redraw !== null
        ? prev.map((r, i) => i === redraw ? { ...r, x, y, w, h } : r)
        : [...prev, { x, y, w, h, label: `Bereich ${prev.length + 1}`, cardIds: [] }]);
      setRedraw(null);
    }
  }

  const removeRegion = (i: number) => { setRegions((prev) => prev.filter((_, j) => j !== i)); setRedraw(null); };
  const setLabel = (i: number, label: string) =>
    setRegions((prev) => prev.map((r, j) => (j === i ? { ...r, label } : r)));

  async function save() {
    if (!userId || saving) return;
    if (isEditing) {
      if (!group || !dirty) return;
      setSaving(true); setError(null);
      try {
        await editOcclusionImage(deckId, {
          sourceImageUrl: group.path,
          expectedCards: group.cards.map(c => ({ id: c.id, back: c.back, extraData: c.extraData ?? {} })),
          regions: regions.map((r, i) => ({ ...r, label: r.label.trim() || `Bereich ${i + 1}` })),
        });
        savedRef.current = true;
        router.push(backHref);
      } catch (e) {
        setError(isApiError(e) && e.code === "PAYWALL_REQUIRED"
          ? "Neue Bereiche sind eine Pro-Funktion — Pro gibt es in der clearn-App. Bestehende Bereiche kannst du weiter bearbeiten."
          : e instanceof Error ? e.message : "Speichern fehlgeschlagen. Deine Änderungen bleiben hier erhalten.");
        setSaving(false);
      }
      return;
    }
    if (!file || regions.length === 0) return;
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
      const clean = regions.map((r, i) => ({ x: r.x, y: r.y, w: r.w, h: r.h, label: r.label.trim() || `Bereich ${i + 1}` }));
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
      savedRef.current = true;
      router.push(`/dashboard/deck/${deckId}`);
    } catch (e) {
      // Teil-Erfolg zurückrollen: bereits erstellte Karten und das hochgeladene
      // Bild wieder entfernen, damit ein erneuter Versuch sauber startet — sonst
      // entstünden Duplikate und ein verwaistes Bild im Speicher.
      if (createdIds.length > 0) {
        await Promise.allSettled(createdIds.map((id) => deleteCard(id)));
      }
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      if (isApiError(e) && e.code === "DECK_FULL") {
        // Seit #371 unterscheidbar: Ein volles Deck ist KEINE Pro-Frage. Vorher
        // fing der 402-Zweig darunter auch diesen Fall ab und behauptete,
        // Bild-Occlusion sei eine Pro-Funktion — obwohl sie freigeschaltet war
        // und nur der Platz fehlte.
        setError("Dieses Deck ist voll. Leg für weitere Karten ein zweites Deck an.");
      } else if (isApiError(e) && e.code === "PAYWALL_REQUIRED") {
        // Occlusion ist serverseitig eine Pro-Funktion. Die rohe englische
        // Server-Meldung wäre hier eine Sackgasse: das Web hat gar keinen
        // Kaufweg (#368), gekauft wird nur in der App — also sagen wir genau
        // das, statt „Upgrade to unlock it." ins Leere (#364).
        setError("Bild-Occlusion ist eine Pro-Funktion — Pro gibt es in der clearn-App.");
      } else {
        setError(isApiError(e) ? e.message : e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
      }
      setSaving(false);
    }
  }

  // Bestätigt "free" → Editor gar nicht erst anbieten. Wortlaut wie die
  // Speichern-Meldung aus #370. Bewusst KEIN Kauf-Knopf: das Web hat gar keinen
  // Kaufweg (#368), gekauft wird nur in der App.
  if (proGate === "free" && !isEditing) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <ImageIcon size={30} />
        </div>
        <h3>Pro-Funktion</h3>
        <p>Bild-Occlusion ist eine Pro-Funktion — Pro gibt es in der clearn-App.</p>
        <Link href={`/dashboard/deck/${deckId}`} className="btn btn-primary">
          Zurück zum Deck
        </Link>
      </div>
    );
  }

  if (loading) return <div className="loading"><span className="spinner" /></div>;
  if (isEditing && !group) return <div className="empty-state"><h3>Bild nicht verfügbar</h3><p role="alert">{error}</p><Link href={backHref} className="btn btn-primary">Deine Bilder</Link></div>;

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
      <Link
        href={backHref}
        className="crumb"
        onClick={(e) => {
          // Mit gezeichneten Kästchen erst nachfragen (#608) — die Navigation
          // übernimmt dann der „Verwerfen"-Knopf der Nachfrage.
          if (dirty) {
            e.preventDefault();
            setConfirm("leave");
          }
        }}
      >
        <ArrowLeft size={16} /> {isEditing ? "Deine Bilder" : "Zurück zum Deck"}
      </Link>

      <div className="cl-intro" style={{ marginBottom: 8 }}>
        <span
          className="cl-intro__ic"
          aria-hidden
          style={{ background: "rgba(5,150,105,0.14)", color: "#059669" }}
        >
          <ImageIcon size={28} />
        </span>
        <h1 className="h2">{isEditing ? "Bild bearbeiten" : "Occlusion-Karten"}</h1>
        <p className="muted">{isEditing ? "Bereiche ändern — bestehende Karten und Lernstände bleiben erhalten" : "Bild wählen, Kästchen über Teile ziehen, beschriften"}</p>
      </div>

      <div className="occ-tools">
        {/* Knopf + verstecktes Feld statt <label>: Mit gezeichneten Kästchen
            muss VOR dem Dateidialog die Nachfrage kommen (#608) — ein Label
            hätte den Dialog immer sofort geöffnet. */}
        {!isEditing && <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (regions.length > 0) setConfirm("newImage");
            else fileInputRef.current?.click();
          }}
        >
          {imageSrc ? "Anderes Bild" : "Bild wählen"}
        </button>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickImage(f);
            // Zurücksetzen, damit auch die erneute Wahl DERSELBEN Datei ein
            // change-Ereignis auslöst — nach „Verwerfen" wird sie erwartet.
            e.target.value = "";
          }}
        />
        {regions.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => setConfirm("clear")}>
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
            style={{ maxWidth: `${60 * imageAspect}vh`, marginInline: "auto" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => setDraw(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageSrc} alt="Occlusion-Vorlage" draggable={false} onLoad={e => setImageAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
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
                  aria-label={`Bereich ${i + 1} entfernen`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeRegion(i)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {drawBox && <div className="occ-draw" style={drawBox} />}
          </div>
          {redraw !== null && <p className="occ-hint" role="status">Zeichne Bereich {redraw + 1} neu. <button type="button" className="btn btn-ghost" onClick={() => setRedraw(null)}>Abbrechen</button></p>}
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
                    aria-label={`Beschriftung Bereich ${i + 1}`}
                    maxLength={200}
                    disabled={saving}
                    onChange={(e) => setLabel(i, e.target.value)}
                  />
                  <button type="button" className="btn btn-ghost" aria-pressed={redraw === i} disabled={saving} onClick={() => setRedraw(i)}>Neu zeichnen</button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Bereich ${i + 1} entfernen`}
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
        disabled={!imageSrc || (isEditing ? !dirty : regions.length === 0) || saving}
        onClick={() => { if (isEditing && removedCount > 0) setConfirm("save"); else void save(); }}
      >
        {saving ? (
          "Wird gespeichert…"
        ) : isEditing ? (
          "Änderungen speichern"
        ) : (
          <>
            <Check size={18} /> {regions.length || ""} Occlusion-
            {regions.length === 1 ? "Karte" : "Karten"} erstellen
          </>
        )}
      </button>

      {confirm !== null && (
        // Escape und Klick neben das Fenster schließen nur die Nachfrage —
        // die zerstörende Wahl braucht einen ausdrücklichen Knopfdruck.
        <Modal
          title={confirm === "save" ? "Entfernte Bereiche speichern?" : confirm === "clear" ? "Alle Bereiche löschen?" : "Änderungen verwerfen?"}
          onClose={() => setConfirm(null)}
        >
          <p className="muted" style={{ margin: 0 }}>
            {confirm === "save"
              ? `${removedCount} ${removedCount === 1 ? "Karte wandert" : "Karten wandern"} in den Papierkorb. Die übrigen Karten behalten ihren Lernstand. Das Bild bleibt gespeichert.`
              : confirm === "clear"
              ? "Alle gezeichneten Kästchen werden entfernt — das Bild bleibt."
              : "Deine gezeichneten Kästchen gehen sonst verloren."}
          </p>
          <div className="modal__actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const which = confirm;
                setConfirm(null);
                if (which === "save") void save();
                else if (which === "leave") router.push(backHref);
                else if (which === "clear") { setRegions([]); setRedraw(null); }
                else if (which === "newImage") fileInputRef.current?.click();
              }}
            >
              {confirm === "save" ? "Speichern und in den Papierkorb" : confirm === "clear" ? "Löschen" : "Verwerfen"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setConfirm(null)}
              autoFocus
            >
              {confirm === "save" || confirm === "clear" ? "Abbrechen" : "Weiter zeichnen"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
