"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { Modal } from "@/components/app/modal";
import {
  scanText,
  importFromUrl,
  scanImage,
  importPdf,
  getLpBalance,
  listDecks,
  saveImportedCards,
  isApiError,
  type AiUsageResponse,
  type Deck,
  type Flashcard,
  type ScanResponse,
} from "@/lib/api";
import { compressImageToJpeg, fileToBase64 } from "@/lib/files";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";
import {
  DECK_LIMIT_LABEL,
  deckLimitNotice,
  deckOptionLabel,
  deckSpaceNotice,
  freeSlots,
  planLimitMessage,
  savedSummary,
} from "@/lib/import-limits";
import {
  ArrowLeft,
  ChevronRight,
  Camera,
  ImageIcon,
  TextType,
  Link as LinkIcon,
  FileText,
  Layers,
  Sparkles,
  Zap,
  AlertTriangle,
  CheckCircle,
  Trash,
  Plus,
  GripVertical,
} from "@/components/icons";

// Ablauf wie im Scan-Bildschirm der App: erst die Quelle wählen ("choose"),
// dann die Eingabe für diese Quelle.
type Mode = "choose" | "photo" | "gallery" | "text" | "url" | "pdf";

/** #427: Karte von `from` an Stelle `to` verschieben (Ziehgriff-Reihenfolge). */
function moveDraftCard(cards: Flashcard[], from: number, to: number): Flashcard[] {
  if (from === to || from < 0 || to < 0 || from >= cards.length || to >= cards.length) {
    return cards;
  }
  const next = [...cards];
  const [moved] = next.splice(from, 1);
  if (!moved) return cards;
  next.splice(to, 0, moved);
  return next;
}

const MAX_TEXT = 20000;
// Vercel lehnt Anfragen über ~4,5 MB ab; base64 bläht ~33% auf → wir bleiben
// mit Sicherheitsabstand unter 4 Mio. Zeichen.
const MAX_BASE64 = 4_000_000;
// PDF-Import ist API-seitig repariert (unpdf, PR #138) und auf Prod verifiziert.
const PDF_ENABLED = true;

export default function ImportPage() {
  const { userId } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("choose");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [prepping, setPrepping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<AiUsageResponse | null>(null);
  // #411: Die vorhandenen Decks — für die Grenz-Prüfung VOR dem Ausgeben von
  // Lernpunkten. `null` heißt „noch nicht geladen"; dann wird nichts gesperrt
  // (der Server prüft ohnehin und bucht notfalls zurück).
  // #427: Dieselbe Liste ist zugleich die Zielauswahl — sie bringt über
  // `cardCount` mit, wie voll jedes Deck schon ist.
  const [decks, setDecks] = useState<Deck[] | null>(null);
  // Ziel des Imports: `null` = neues Deck (wie bisher), sonst die Deck-ID.
  // Gewählt wird es seit #427 erst in der Vorschau, wenn die Karten dastehen.
  const [targetDeckId, setTargetDeckId] = useState<string | null>(null);
  // #427: Die erzeugten, noch NICHT gespeicherten Karten. Solange das gesetzt
  // ist, zeigt die Seite die Vorschau: bearbeiten, einzeln löschen, Ziel wählen.
  const [draft, setDraft] = useState<Flashcard[] | null>(null);
  // #534: Zeigt den Verwerfen-Bestätigungsdialog, statt sofort zu löschen.
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [newDeckTitle, setNewDeckTitle] = useState("");
  const [saving, setSaving] = useState(false);
  // #427: Welche Karte gerade am Ziehgriff gezogen wird (null = keine).
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Gesetzt, wenn die Tarifgrenze den Import ausgedünnt hat: dann NICHT
  // stillschweigend ins neue Deck springen, sondern erst sagen, was fehlt.
  const [summary, setSummary] = useState<{ text: string; href: string } | null>(null);
  // Desktop erkennt man am „feinen" Zeiger (Maus). „Foto aufnehmen" (Kamera)
  // ist nur am Handy sinnvoll — am Desktop wird das capture-Attribut ignoriert
  // und es öffnet nur der Datei-Dialog (dann identisch zu „Bild wählen").
  const coarsePointer = useCoarsePointer();

  const photoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  // Stabiler Idempotenz-Schlüssel PRO Inhalt: ein Retry mit demselben Inhalt
  // nutzt denselben Schlüssel → der Server gibt das gecachte Ergebnis zurück
  // (kein zweiter LP-Abzug). Neuer Inhalt → neuer Schlüssel.
  const attemptRef = useRef<{ sig: string; key: string } | null>(null);

  useEffect(() => {
    let active = true;
    getLpBalance()
      .then((u) => {
        if (active) setUsage(u);
      })
      .catch(() => {
        /* LP-Anzeige ist optional — der Server prüft ohnehin */
      });
    return () => {
      active = false;
    };
  }, []);

  // #411: Deckliste für die Grenz-Prüfung. Schlägt sie fehl, bleibt deckCount
  // null und es wird nichts gesperrt — lieber einmal nicht vorgewarnt als ein
  // Konto ausgesperrt, das in Wahrheit noch Platz hat.
  useEffect(() => {
    if (!userId) return;
    let active = true;
    listDecks(userId)
      .then(({ decks: loaded }) => {
        if (active) setDecks(loaded);
      })
      .catch(() => {
        /* Vorwarnung ist Kür — der Server prüft ohnehin */
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const cost = usage
    ? mode === "url"
      ? usage.lpCostUrlImport
      : mode === "pdf"
        ? usage.lpCostPdfImport
        : usage.lpCostAiScan // text, photo, gallery
    : null;
  const enoughLp = usage && cost !== null ? usage.lpBalance >= cost : true;
  // Für den Hinweis im Auswahl-Menü: reicht es nicht mal für den günstigsten Import?
  const lowLp = usage ? usage.lpBalance < usage.lpCostAiScan : false;

  const deckCount = decks?.length ?? null;
  // #411: Ist die Deck-Grenze erreicht, lehnt der Server jedes NEUE Deck ab.
  // #427: Seit es eine Zielauswahl gibt, ist das keine Sackgasse mehr — nur der
  // Weg „neues Deck" ist zu. Gesperrt wird deshalb nicht mehr die Quelle,
  // sondern erst das Absenden, solange „Neues Deck" gewählt ist. So gibt auch
  // hier niemand Lernpunkte für eine Anfrage aus, die der Server ablehnen muss.
  const deckLimitHint = deckLimitNotice(deckCount, usage?.limits?.maxDecks);
  const deckLimitReached = deckLimitHint !== null;

  // #427: Ziel-Deck und wie viel dort noch hineinpasst.
  const targetDeck = targetDeckId ? (decks?.find((d) => d.id === targetDeckId) ?? null) : null;
  const targetFreeSlots = targetDeck
    ? freeSlots(targetDeck.cardCount, usage?.limits?.maxCardsPerDeck)
    : null;
  const spaceHint = deckSpaceNotice(targetFreeSlots);
  const hasDecks = (decks?.length ?? 0) > 0;
  // „Neues Deck" gewählt, obwohl keines mehr erlaubt ist → Absenden sperren.
  const newDeckBlocked = deckLimitReached && targetDeckId === null;
  // Volles Ziel-Deck: der Server würde alles abweisen, also gar nicht erst los.
  const targetDeckFull = targetFreeSlots === 0;
  // #427: Karten mit Inhalt — selbst hinzugefügte, leere zählen nicht mit.
  const savableCount = (draft ?? []).filter((c) => c.front.trim() || c.back.trim()).length;

  const hasInput =
    mode === "text"
      ? text.trim().length > 0
      : mode === "url"
        ? url.trim().length > 0
        : mode === "photo" || mode === "gallery"
          ? Boolean(imageBase64)
          : mode === "pdf"
            ? Boolean(pdfBase64)
            : false;

  function choose(next: Exclude<Mode, "choose">) {
    setError(null);
    setMode(next);
    if (next === "photo" || next === "gallery") {
      setImageBase64(null);
      setImagePreview(null);
    }
    if (next === "pdf") {
      setPdfBase64(null);
      setPdfFileName(null);
    }
    // Direkt die passende Datei-/Kamera-Auswahl öffnen (wie in der App)
    if (next === "photo") photoInputRef.current?.click();
    else if (next === "gallery") galleryInputRef.current?.click();
    else if (next === "pdf") pdfInputRef.current?.click();
  }

  function openImagePicker() {
    (mode === "photo" ? photoInputRef : galleryInputRef).current?.click();
  }

  async function onImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // erlaubt erneutes Wählen derselben Datei
    if (!file) return;
    setError(null);
    setPrepping(true);
    try {
      const { base64, previewUrl } = await compressImageToJpeg(file);
      if (base64.length > MAX_BASE64) {
        setError("Das Foto ist zu groß. Bitte näher heran oder ein kleineres Bild.");
        return;
      }
      setImageBase64(base64);
      setImagePreview(previewUrl);
    } catch {
      setError("Dieses Bildformat konnte nicht gelesen werden. Bitte JPG oder PNG (kein HEIC).");
    } finally {
      setPrepping(false);
    }
  }

  async function onPdfPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (file.type !== "application/pdf") {
      setError("Bitte eine PDF-Datei wählen.");
      return;
    }
    setPrepping(true);
    try {
      const base64 = await fileToBase64(file);
      if (base64.length > MAX_BASE64) {
        setError("Die PDF ist zu groß (max. ca. 3 MB).");
        return;
      }
      setPdfFileName(file.name);
      setPdfBase64(base64);
    } catch {
      setError("Die PDF konnte nicht gelesen werden.");
    } finally {
      setPrepping(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    if (mode === "text" && text.trim().length < 1) {
      setError("Bitte füge zuerst etwas Text ein.");
      return;
    }
    if (mode === "url" && !/^https?:\/\/.+/i.test(url.trim())) {
      setError("Bitte gib eine gültige URL ein (mit https:// davor).");
      return;
    }
    if ((mode === "photo" || mode === "gallery") && !imageBase64) {
      setError("Bitte wähle zuerst ein Bild.");
      return;
    }
    if (mode === "pdf" && !pdfBase64) {
      setError("Bitte wähle zuerst eine PDF.");
      return;
    }
    if (!userId) return;

    setBusy(true);
    // Stabiler Schlüssel pro Inhalt: derselbe Inhalt erneut → derselbe Schlüssel
    // → der Server gibt sein gecachtes Ergebnis zurück (kein zweiter Abzug).
    // Anderer Inhalt → neuer Schlüssel.
    //
    // #427: Das Ziel-Deck gehört mit in den Schlüssel. Sonst gilt „dasselbe PDF
    // in ein anderes Deck" als Wiederholung: Der Server antwortet mit seinem
    // gecachten Ergebnis und schreibt nie ins neu gewählte Deck.
    const content =
      mode === "text"
        ? `t:${text.trim()}`
        : mode === "url"
          ? `u:${url.trim()}`
          : mode === "pdf"
            ? `p:${pdfBase64 ?? ""}`
            : `i:${imageBase64 ?? ""}`;
    const sig = `${targetDeckId ?? "neu"}|${content}`;
    if (!attemptRef.current || attemptRef.current.sig !== sig) {
      const key =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `imp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      attemptRef.current = { sig, key };
    }
    const idemKey = attemptRef.current.key;
    let result: ScanResponse | null = null;
    try {
      // Frischer Deck-Stand für die Zielauswahl in der Vorschau.
      const before = await listDecks(userId);
      setDecks(before.decks);

      // #427: `preview` — die KI arbeitet, gespeichert wird noch nichts. Wohin
      // die Karten sollen, entscheidet die Nutzerin erst, wenn sie sie sieht.
      if (mode === "text") {
        result = await scanText(userId, text.trim(), "de", idemKey, undefined, true);
      } else if (mode === "url") {
        result = await importFromUrl(userId, url.trim(), 4, "de", idemKey, undefined, true);
      } else if (mode === "photo" || mode === "gallery") {
        result = await scanImage(
          userId,
          imageBase64!,
          "image/jpeg",
          "de",
          idemKey,
          undefined,
          true
        );
      } else if (mode === "pdf") {
        result = await importPdf(
          userId,
          pdfFileName ?? "Dokument.pdf",
          pdfBase64!,
          "de",
          idemKey,
          undefined,
          true
        );
      }
    } catch (e) {
      // #411: Tarifgrenze zuerst — der Server antwortet dafür 409, nicht 402.
      // Landete das im 402-Zweig darunter, stünde dort „deine Lernpunkte
      // reichen nicht" für ein Problem, das kein Lernpunkt löst (#371).
      //
      // #426 hat die beiden Zweige hier zuerst gebaut. Ihre Texte passten zum
      // Von-Hand-Weg, auf DIESER Seite aber nicht: Sie verschwiegen, dass die
      // Lernpunkte zurückgebucht wurden, und rieten zu einem Ziel-Deck, das es
      // im Browser nicht gibt (#427). Der Wortlaut kommt deshalb jetzt aus
      // import-limits.ts; der Pro-Zweig aus #426 bleibt unverändert.
      const limitMessage = planLimitMessage(e);
      if (limitMessage) {
        setError(limitMessage);
      } else if (isApiError(e) && e.code === "PAYWALL_REQUIRED") {
        setError("Diese Funktion gehört zu Pro — Pro gibt es in der clearn-App.");
      } else if (isApiError(e) && e.status === 402) {
        // Bleibt der Auffang für INSUFFICIENT_LP.
        setError(
          "Dafür reichen deine Lernpunkte nicht. Neue Lernpunkte bekommst du durchs Lernen — Aufladen und Pro gibt es in der clearn-App."
        );
      } else if (isApiError(e) && e.code === "PDF_TEXT_NOT_FOUND") {
        setError(
          "Diese PDF enthält keinen lesbaren Text — reine Scans werden noch nicht unterstützt. Bitte eine PDF mit echtem Text wählen."
        );
      } else if (isApiError(e) && e.code === "PDF_IMPORT_FAILED") {
        setError("Die PDF konnte nicht verarbeitet werden. Bitte versuch es mit einer anderen Datei.");
      } else {
        setError(isApiError(e) ? e.message : "Das hat nicht geklappt. Bitte versuch es erneut.");
      }
      setBusy(false);
      return;
    }

    // Erzeugung durch (Lernpunkte verbraucht), gespeichert ist noch nichts.
    // Ein erneuter Klick soll nicht ein zweites Mal abbuchen.
    attemptRef.current = null; // erfolgreich → nächster Import bekommt neuen Schlüssel

    // #521: Der Scan hat Lernpunkte abgebucht und der Server schickt den neuen
    // Stand gleich mit — die Pille oben soll ihn sofort zeigen, nicht erst nach
    // einem Seitenwechsel. Fehlt er (älterer Server), einmal frisch nachfragen.
    const newBalance = result?.usage?.lpBalance;
    if (typeof newBalance === "number") {
      setUsage((u) => (u ? { ...u, lpBalance: newBalance } : u));
    } else {
      getLpBalance()
        .then((u) => setUsage(u))
        .catch(() => {
          /* Anzeige bleibt dann alt — der Server prüft ohnehin */
        });
    }

    // #427: Ab hier übernimmt die Vorschau. Der Titelvorschlag der KI steht im
    // Feld für ein neues Deck und lässt sich überschreiben.
    setDraft(result?.cards ?? []);
    setNewDeckTitle(result?.deckTitle ?? "Neue Karten");
    setTargetDeckId(null);
    setBusy(false);
  }

  /** #427: Die durchgesehenen Karten ablegen — neues Deck oder bestehendes. */
  async function handleSave() {
    if (!draft) return;
    // #427: Selbst hinzugefügte, leer gelassene Karten überspringen — sonst
    // legt der Server ein leeres Kärtchen an bzw. weist den Import ab.
    const cards = draft.filter((c) => c.front.trim() || c.back.trim());
    if (cards.length === 0) {
      setError("Bitte fülle mindestens eine Karte aus.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result = await saveImportedCards({
        cards,
        ...(targetDeckId ? { deckId: targetDeckId } : { title: newDeckTitle.trim() || "Neue Karten" }),
      });

      const target = `/dashboard/deck/${result.deckId}`;
      // #411: Passt das Material nicht ganz ins Deck, dünnt der Server
      // gleichmäßig aus. Dann erst sagen, was fehlt, statt stumm zu springen.
      const offered = result.generatedCount;
      const saved = result.savedCount;
      if (typeof offered === "number" && typeof saved === "number" && saved < offered) {
        setSummary({ text: savedSummary(offered, saved), href: target });
        setDraft(null);
        setSaving(false);
        return;
      }
      setDraft(null);
      router.push(target);
    } catch (e) {
      const limitMessage = planLimitMessage(e);
      setError(
        limitMessage ??
          (isApiError(e) ? e.message : "Speichern hat nicht geklappt. Bitte versuch es erneut.")
      );
      setSaving(false);
    }
  }

  /** Karte in der Vorschau ändern — die Fassung der Nutzerin wird gespeichert. */
  function editDraftCard(index: number, side: "front" | "back", value: string) {
    setDraft((cards) =>
      cards ? cards.map((card, i) => (i === index ? { ...card, [side]: value } : card)) : cards
    );
  }

  function removeDraftCard(index: number) {
    setDraft((cards) => (cards ? cards.filter((_card, i) => i !== index) : cards));
  }

  // #534: Nicht mehr sofort verwerfen. Erst der App-eigene Dialog fragt nach —
  // wie bei anderen destruktiven Aktionen im Web (z. B. Karte löschen) — damit
  // ein Fehlklick nicht Karten und die dafür ausgegebenen Lernpunkte kostet.
  // Der schlichte window.confirm wich diesem, passend zum App-Look.
  function handleDiscard() {
    setConfirmDiscard(true);
  }

  function discardDraft() {
    setConfirmDiscard(false);
    setDraft(null);
    setError(null);
    setMode("choose");
  }

  /** #427: Eine leere Karte anhängen, die man selbst ausfüllt. */
  function addDraftCard() {
    setDraft((cards) => [
      ...(cards ?? []),
      { front: "", back: "", type: "basic", difficulty: "medium", tags: [] },
    ]);
  }

  // ─── Reihenfolge per Ziehgriff (#427) ───────────────────────────────────────
  // Pointer-Events wie bei der Ordner-Sortierung (#437): HTML5-Drag feuert am
  // Handy nicht, Pointer-Capture + elementFromPoint schon. Der Griff trägt
  // `touch-action: none`, damit der Browser dort nicht scrollt. Anders als bei
  // den Ordnern wird NICHTS gespeichert — die Reihenfolge zählt erst beim
  // „Speichern".
  function onGripPointerDown(e: React.PointerEvent<HTMLButtonElement>, index: number) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragIndex(index);
  }

  function onGripPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragIndex === null) return;
    const over = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>("[data-draft-index]");
    if (!over) return;
    const target = Number(over.dataset.draftIndex);
    if (Number.isNaN(target) || target === dragIndex) return;
    setDraft((cards) => (cards ? moveDraftCard(cards, dragIndex, target) : cards));
    setDragIndex(target);
  }

  function onGripPointerUp() {
    setDragIndex(null);
  }

  return (
    <>
      <Link href="/dashboard" className="crumb">
        <ArrowLeft size={16} /> Bibliothek
      </Link>

      <div className="lib-head">
        <div>
          <h1>Scan</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Aus Foto, Text, Webseite oder PDF macht die KI in Sekunden fertige Lernkarten.
          </p>
        </div>
        {usage && (
          <Link
            href="/dashboard/lp"
            className={lowLp ? "lp-pill is-low" : "lp-pill"}
            aria-label="Lernpunkte ansehen"
          >
            <Zap size={15} /> {usage.lpBalance.toLocaleString("de-DE")} LP
          </Link>
        )}
      </div>

      {/* Die Quellen-Auswahl darf am Desktop die Breite nutzen; die Eingabe
          danach bleibt schmal — ein über 1.000 Pixel breites Textfeld liest
          und tippt sich schlecht. */}
      <div
        className={
          (mode === "choose" || draft) && !summary
            ? "import-view import-view--wide"
            : "import-view"
        }
      >
        {/* Versteckte Datei-/Kamera-Auswahl (immer im DOM, damit die Karten sie öffnen können) */}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={onImagePicked}
        />
        <input ref={galleryInputRef} type="file" accept="image/*" hidden onChange={onImagePicked} />
        <input ref={pdfInputRef} type="file" accept="application/pdf" hidden onChange={onPdfPicked} />

        {summary ? (
          // #411: Ehrlich melden, statt kommentarlos ins Deck zu springen.
          <div role="status">
            <div className="lp-warn">
              <Layers size={16} />
              <span>{summary.text}</span>
            </div>
            <p className="muted" style={{ marginTop: 0, marginBottom: 18 }}>
              Es hat nicht alles in das Deck gepasst. Die gespeicherten Karten sind gleichmäßig
              über den ganzen Stoff verteilt — nicht einfach die ersten.
            </p>
            <Link href={summary.href} className="btn btn-primary btn-block btn-lg">
              Deck öffnen
            </Link>
          </div>
        ) : draft ? (
          /* #427: Die Karten sind da, aber noch nirgends. Hier wird gelesen,
             verbessert, aussortiert — und erst dann gespeichert. */
          <>
            <div className="draft-head">
              <CheckCircle size={22} style={{ color: "var(--green)", flex: "none" }} />
              <div>
                <h2 className="draft-head__t">
                  {draft.length} {draft.length === 1 ? "Karte" : "Karten"} erstellt
                </h2>
                <p className="muted" style={{ margin: "2px 0 0", fontSize: "0.88rem" }}>
                  Sieh sie dir an und ändere, was nicht passt — gespeichert wird erst danach.
                </p>
              </div>
            </div>

            <div className="draft-grid">
              <div className="draft-list">
                {draft.map((card, index) => (
                  <div
                    className={dragIndex === index ? "draft-card is-dragging" : "draft-card"}
                    key={index}
                    data-draft-index={index}
                  >
                    <div className="draft-card__head">
                      <span className="draft-card__n">
                        {draft.length > 1 && (
                          <button
                            type="button"
                            className="draft-card__grip"
                            aria-label={`Karte ${index + 1} verschieben`}
                            title="Ziehen zum Sortieren"
                            onPointerDown={(e) => onGripPointerDown(e, index)}
                            onPointerMove={onGripPointerMove}
                            onPointerUp={onGripPointerUp}
                            onPointerCancel={onGripPointerUp}
                          >
                            <GripVertical size={16} />
                          </button>
                        )}
                        Karte {index + 1}
                      </span>
                      <button
                        type="button"
                        className="draft-card__del"
                        onClick={() => removeDraftCard(index)}
                        disabled={saving}
                        aria-label={`Karte ${index + 1} löschen`}
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                    <label className="draft-card__lbl" htmlFor={`draft-front-${index}`}>
                      Frage
                    </label>
                    <textarea
                      id={`draft-front-${index}`}
                      className="textarea draft-card__field"
                      value={card.front}
                      onChange={(e) => editDraftCard(index, "front", e.target.value)}
                      disabled={saving}
                      rows={2}
                    />
                    <label className="draft-card__lbl" htmlFor={`draft-back-${index}`}>
                      Antwort
                    </label>
                    <textarea
                      id={`draft-back-${index}`}
                      className="textarea draft-card__field"
                      value={card.back}
                      onChange={(e) => editDraftCard(index, "back", e.target.value)}
                      disabled={saving}
                      rows={3}
                    />
                  </div>
                ))}

                {draft.length === 0 && (
                  <div className="info-note" style={{ marginTop: 0 }}>
                    <AlertTriangle size={16} />
                    <span>
                      Du hast alle Karten gelöscht. Es bleibt nichts zu speichern — ein neuer Scan
                      kostet wieder Lernpunkte.
                    </span>
                  </div>
                )}

                {/* #427: Karte von Hand hinzufügen, wenn etwas fehlt */}
                <button type="button" className="draft-add" onClick={addDraftCard} disabled={saving}>
                  <Plus size={16} /> Karte hinzufügen
                </button>
              </div>

              <div className="draft-side">
                <fieldset className="deck-target">
                  <legend>Wohin damit?</legend>

                  <label
                    className={targetDeckId === null ? "deck-target__opt is-on" : "deck-target__opt"}
                  >
                    <input
                      type="radio"
                      name="deck-target"
                      checked={targetDeckId === null}
                      onChange={() => setTargetDeckId(null)}
                      disabled={saving || deckLimitReached}
                    />
                    <span className="deck-target__txt">
                      <span className="deck-target__t">Neues Deck</span>
                      <span className="deck-target__s">
                        {deckLimitReached
                          ? "Geht gerade nicht — deine Deck-Grenze ist erreicht."
                          : "Titel von der KI, du kannst ihn ändern."}
                      </span>
                    </span>
                  </label>

                  {targetDeckId === null && !deckLimitReached && (
                    <input
                      className="input deck-target__pick"
                      aria-label="Titel des neuen Decks"
                      value={newDeckTitle}
                      maxLength={100}
                      onChange={(e) => setNewDeckTitle(e.target.value)}
                      disabled={saving}
                    />
                  )}

                  {hasDecks && (
                    <label
                      className={
                        targetDeckId !== null ? "deck-target__opt is-on" : "deck-target__opt"
                      }
                    >
                      <input
                        type="radio"
                        name="deck-target"
                        checked={targetDeckId !== null}
                        onChange={() => setTargetDeckId(decks?.[0]?.id ?? null)}
                        disabled={saving}
                      />
                      <span className="deck-target__txt">
                        <span className="deck-target__t">Bestehendes Deck</span>
                        <span className="deck-target__s">
                          Die Karten kommen zu den vorhandenen dazu.
                        </span>
                      </span>
                    </label>
                  )}

                  {targetDeckId !== null && (
                    <select
                      className="select deck-target__pick"
                      aria-label="Ziel-Deck"
                      value={targetDeckId}
                      onChange={(e) => setTargetDeckId(e.target.value)}
                      disabled={saving}
                    >
                      {(decks ?? []).map((deck) => (
                        <option key={deck.id} value={deck.id}>
                          {deckOptionLabel(
                            deck.title,
                            freeSlots(deck.cardCount, usage?.limits?.maxCardsPerDeck)
                          )}
                        </option>
                      ))}
                    </select>
                  )}
                </fieldset>

                {spaceHint && (
                  <div className="lp-warn" role="status" style={{ margin: "14px 0 0" }}>
                    <Layers size={16} />
                    <span>{spaceHint}</span>
                  </div>
                )}

                {error && (
                  <div className="form-error" role="alert" style={{ marginTop: 14 }}>
                    <AlertTriangle size={16} />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-primary btn-block btn-lg"
                  style={{ marginTop: 16 }}
                  onClick={handleSave}
                  disabled={saving || savableCount === 0 || newDeckBlocked || targetDeckFull}
                >
                  {saving
                    ? "Karten werden gespeichert…"
                    : `${savableCount} ${savableCount === 1 ? "Karte" : "Karten"} speichern`}
                </button>

                <button
                  type="button"
                  className="btn btn-ghost btn-block"
                  style={{ marginTop: 8 }}
                  onClick={handleDiscard}
                  disabled={saving}
                >
                  Verwerfen
                </button>
                <p className="muted" style={{ fontSize: "0.78rem", marginTop: 8 }}>
                  Verwerfen bringt die Lernpunkte nicht zurück — die KI hat schon gearbeitet.
                </p>
              </div>
            </div>
          </>
        ) : mode === "choose" ? (
          <>
            {deckLimitHint && (
              <div className="lp-warn" role="status">
                <Layers size={16} />
                <span>
                  <strong style={{ display: "block", marginBottom: 2 }}>{DECK_LIMIT_LABEL}</strong>
                  {deckLimitHint}
                </span>
              </div>
            )}

            {usage && lowLp && (
              <div className="lp-warn" role="status">
                <Zap size={16} />
                <span>
                  Du hast {usage.lpBalance} LP. Ein Scan kostet ab {usage.lpCostAiScan} LP.
                  Neue Lernpunkte bekommst du durchs Lernen.
                </span>
              </div>
            )}

            <div className="source-grid">
              {/* „Foto aufnehmen" nur am Handy (feiner Zeiger = Desktop-Maus →
                  keine echte Kamera, capture wird ignoriert → wie „Bild wählen"). */}
              {coarsePointer && (
                <button
                  type="button"
                  className="source-card source-card--photo"
                  onClick={() => choose("photo")}
                >
                  <span className="source-card__ic">
                    <Camera size={22} />
                  </span>
                  <span className="source-card__body">
                    <span className="source-card__title">Foto aufnehmen</span>
                    <span className="source-card__hint">Buchseite, Tafel, Notizen</span>
                  </span>
                  {usage && (
                    <span className="source-card__cost">
                      <Zap size={12} /> {usage.lpCostAiScan} LP
                    </span>
                  )}
                  <ChevronRight size={20} className="source-card__chevron" />
                </button>
              )}

              <button
                type="button"
                className="source-card source-card--gallery"
                onClick={() => choose("gallery")}
              >
                <span className="source-card__ic">
                  <ImageIcon size={22} />
                </span>
                <span className="source-card__body">
                  <span className="source-card__title">Bild wählen</span>
                  {/* Wortlaut der App (scan.cameraHint) */}
                  <span className="source-card__hint">Lehrbuch, Tafel, Notizen</span>
                </span>
                {usage && (
                  <span className="source-card__cost">
                    <Zap size={12} /> {usage.lpCostAiScan} LP
                  </span>
                )}
                <ChevronRight size={20} className="source-card__chevron" />
              </button>

              <button
                type="button"
                className="source-card source-card--text"
                onClick={() => choose("text")}
              >
                <span className="source-card__ic">
                  <TextType size={22} />
                </span>
                <span className="source-card__body">
                  <span className="source-card__title">Text eingeben</span>
                  <span className="source-card__hint">Zusammenfassung, Notizen, Definitionen</span>
                </span>
                {usage && (
                  <span className="source-card__cost">
                    <Zap size={12} /> {usage.lpCostAiScan} LP
                  </span>
                )}
                <ChevronRight size={20} className="source-card__chevron" />
              </button>

              <button
                type="button"
                className="source-card source-card--url"
                onClick={() => choose("url")}
              >
                <span className="source-card__ic">
                  <LinkIcon size={22} />
                </span>
                <span className="source-card__body">
                  <span className="source-card__title">URL importieren</span>
                  <span className="source-card__hint">Webseite als Lernkarten</span>
                </span>
                {usage && (
                  <span className="source-card__cost">
                    <Zap size={12} /> {usage.lpCostUrlImport} LP
                  </span>
                )}
                <ChevronRight size={20} className="source-card__chevron" />
              </button>

              {PDF_ENABLED && (
                <button
                  type="button"
                  className="source-card source-card--pdf"
                  onClick={() => choose("pdf")}
                >
                  <span className="source-card__ic">
                    <FileText size={22} />
                  </span>
                  <span className="source-card__body">
                    <span className="source-card__title">PDF importieren</span>
                    <span className="source-card__hint">Skript, Handout, Zusammenfassung</span>
                  </span>
                  {usage && (
                    <span className="source-card__cost">
                      <Zap size={12} /> {usage.lpCostPdfImport} LP
                    </span>
                  )}
                  <ChevronRight size={20} className="source-card__chevron" />
                </button>
              )}
            </div>

            {/* Am Desktop bleibt unter den Kacheln viel Platz. Statt ihn leer zu
                lassen oder die Kacheln zu dehnen, steht dort, was gleich
                passiert — am Handy untereinander wie alles andere. */}
            <ol className="scan-steps">
              <li>
                <span className="scan-steps__n">1</span>
                <span>Quelle wählen und Material hochladen</span>
              </li>
              <li>
                <span className="scan-steps__n">2</span>
                <span>Die KI liest und schreibt Frage-Antwort-Karten</span>
              </li>
              <li>
                <span className="scan-steps__n">3</span>
                <span>Die Karten landen im Deck, das du aussuchst</span>
              </li>
            </ol>

            <div className="info-note">
              <Sparkles size={16} />
              <span>
                Die KI liest dein Material und macht daraus automatisch Frage-Antwort-Karten — aus
                Foto, Text, Webseite oder PDF.
              </span>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="back-link"
              onClick={() => {
                setMode("choose");
                setError(null);
              }}
              disabled={busy}
            >
              <ArrowLeft size={16} /> Andere Quelle wählen
            </button>

            {mode === "text" && (
              <div className="field">
                <label htmlFor="import-text">Dein Lernstoff als Text</label>
                <textarea
                  id="import-text"
                  className="textarea"
                  style={{ minHeight: 220 }}
                  value={text}
                  maxLength={MAX_TEXT}
                  onChange={(e) => setText(e.target.value)}
                  disabled={busy}
                  placeholder="Füge hier deinen Text ein — z. B. eine Zusammenfassung, Notizen oder Definitionen. Die KI macht daraus Frage-Antwort-Karten."
                />
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  {text.length.toLocaleString("de-DE")} / {MAX_TEXT.toLocaleString("de-DE")} Zeichen
                </span>
              </div>
            )}

            {mode === "url" && (
              <div className="field">
                <label htmlFor="import-url">Webseiten-Adresse (URL)</label>
                <input
                  id="import-url"
                  className="input"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={busy}
                  placeholder="https://de.wikipedia.org/wiki/Mitochondrium"
                />
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  Die KI liest den Inhalt der Seite und macht Karten daraus.
                </span>
              </div>
            )}

            {(mode === "photo" || mode === "gallery") && (
              <div className="field">
                <label>{mode === "photo" ? "Foto" : "Bild aus der Galerie"}</label>
                {imagePreview ? (
                  <div className="file-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Vorschau des gewählten Bildes" />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={openImagePicker}
                      disabled={busy || prepping}
                    >
                      {mode === "photo" ? "Anderes Foto" : "Anderes Bild"}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    onClick={openImagePicker}
                    disabled={busy || prepping}
                  >
                    {prepping
                      ? "Bild wird vorbereitet…"
                      : mode === "photo"
                        ? "Foto aufnehmen"
                        : "Aus Galerie wählen"}
                  </button>
                )}
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  Die KI liest das Bild und macht daraus Karten.
                </span>
              </div>
            )}

            {mode === "pdf" && (
              <div className="field">
                <label>PDF-Datei</label>
                {pdfFileName ? (
                  <div className="file-preview">
                    <div className="pdf-file">
                      <FileText size={20} />
                      <span className="pdf-file__name">{pdfFileName}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => pdfInputRef.current?.click()}
                      disabled={busy || prepping}
                    >
                      Andere PDF
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={busy || prepping}
                  >
                    {prepping ? "PDF wird gelesen…" : "PDF auswählen"}
                  </button>
                )}
                <span className="muted" style={{ fontSize: "0.8rem" }}>
                  Nur PDFs mit echtem Text (keine reinen Scans), max. ca. 3 MB.
                </span>
              </div>
            )}

            {usage && !enoughLp && !error && (
              <div className="lp-warn" role="status" style={{ marginTop: 14, marginBottom: 0 }}>
                <Zap size={16} />
                <span>
                  Dafür reichen deine Lernpunkte nicht ({usage.lpBalance} von {cost}). Neue
                  Lernpunkte bekommst du durchs Lernen.
                </span>
              </div>
            )}

            {error && (
              <div className="form-error" role="alert" style={{ marginTop: 14 }}>
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              style={{ marginTop: 20 }}
              onClick={handleSubmit}
              // #411/#427: Nichts absenden, was der Server sicher ablehnt —
              // sonst fließen Lernpunkte für eine Fehlermeldung. Das betrifft
              // jetzt „neues Deck trotz Deck-Grenze" und „Ziel-Deck ist voll".
              disabled={
                busy ||
                prepping ||
                !hasInput ||
                newDeckBlocked ||
                targetDeckFull ||
                (usage ? !enoughLp : false)
              }
            >
              {busy ? (
                // Wortlaut der App während der Verarbeitung („Flashcards werden generiert...")
                "Flashcards werden generiert…"
              ) : (
                <>
                  <Sparkles size={18} /> Karten erstellen
                  {cost !== null && (
                    <span className="btn-cost">
                      <Zap size={13} /> {cost}
                    </span>
                  )}
                </>
              )}
            </button>

            {busy && (
              <p className="muted center" style={{ marginTop: 14 }}>
                Das kann ein paar Sekunden dauern — die KI liest dein Material und formt Karten.
              </p>
            )}
          </>
        )}
      </div>

      {confirmDiscard && draft && (
        <Modal title="Karten verwerfen?" onClose={() => setConfirmDiscard(false)}>
          <p className="muted">
            Alle {draft.length} erzeugten {draft.length === 1 ? "Karte wird" : "Karten werden"}{" "}
            gelöscht. Die dafür ausgegebenen Lernpunkte kommen nicht zurück.
          </p>
          <div className="modal__actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmDiscard(false)}
            >
              Abbrechen
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: "#dc2626", boxShadow: "none" }}
              onClick={discardDraft}
            >
              Verwerfen
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
