"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import {
  scanText,
  importFromUrl,
  scanImage,
  importPdf,
  getLpBalance,
  listDecks,
  isApiError,
  type AiUsageResponse,
  type Deck,
} from "@/lib/api";
import { compressImageToJpeg, fileToBase64 } from "@/lib/files";
import {
  ArrowLeft,
  ChevronRight,
  Camera,
  ImageIcon,
  TextType,
  Link as LinkIcon,
  FileText,
  Sparkles,
  Zap,
  AlertTriangle,
} from "@/components/icons";

// Ablauf wie im Scan-Bildschirm der App: erst die Quelle wählen ("choose"),
// dann die Eingabe für diese Quelle.
type Mode = "choose" | "photo" | "gallery" | "text" | "url" | "pdf";

const MAX_TEXT = 20000;
// Vercel lehnt Anfragen über ~4,5 MB ab; base64 bläht ~33% auf → wir bleiben
// mit Sicherheitsabstand unter 4 Mio. Zeichen.
const MAX_BASE64 = 4_000_000;
// PDF-Karte ist fertig, aber der PDF-Endpunkt der clearn-API wirft aktuell 500
// (pdfjs lädt in der Serverless-Umgebung nicht). Bis das API-seitig behoben ist,
// blenden wir die Karte aus. Danach einfach auf true stellen.
const PDF_ENABLED = false;

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

  const photoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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

  const findNewDeck = useCallback(
    async (beforeIds: Set<string>): Promise<Deck | null> => {
      if (!userId) return null;
      const { decks } = await listDecks(userId);
      const created = decks.find((d) => !beforeIds.has(d.id));
      if (created) return created;
      // Fallback: neuestes Deck (falls die ID-Erkennung mal nicht greift)
      return [...decks].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
    },
    [userId]
  );

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
    try {
      const before = await listDecks(userId);
      const beforeIds = new Set(before.decks.map((d) => d.id));

      if (mode === "text") {
        await scanText(userId, text.trim());
      } else if (mode === "url") {
        await importFromUrl(userId, url.trim());
      } else if (mode === "photo" || mode === "gallery") {
        await scanImage(userId, imageBase64!, "image/jpeg");
      } else if (mode === "pdf") {
        await importPdf(userId, pdfFileName ?? "Dokument.pdf", pdfBase64!);
      }

      const created = await findNewDeck(beforeIds);
      router.push(created ? `/dashboard/deck/${created.id}` : "/dashboard");
      // absichtlich kein setBusy(false): die Seite navigiert weg
    } catch (e) {
      if (isApiError(e) && e.status === 402) {
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
    }
  }

  return (
    <>
      <Link href="/dashboard" className="crumb">
        <ArrowLeft size={16} /> Bibliothek
      </Link>

      <div className="lib-head">
        <div>
          <h1>Karten per KI erstellen</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Aus Foto, Text, Webseite oder PDF macht die KI in Sekunden fertige Lernkarten.
          </p>
        </div>
        {usage && (
          <span className={lowLp ? "lp-pill is-low" : "lp-pill"}>
            <Zap size={15} /> {usage.lpBalance.toLocaleString("de-DE")} LP
          </span>
        )}
      </div>

      <div className="import-view">
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

        {mode === "choose" ? (
          <>
            {usage && lowLp && (
              <div className="lp-warn" role="status">
                <Zap size={16} />
                <span>
                  Du hast {usage.lpBalance} LP. Ein KI-Import kostet ab {usage.lpCostAiScan} LP.
                  Neue Lernpunkte bekommst du durchs Lernen.
                </span>
              </div>
            )}

            <div className="source-grid">
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

              <button
                type="button"
                className="source-card source-card--gallery"
                onClick={() => choose("gallery")}
              >
                <span className="source-card__ic">
                  <ImageIcon size={22} />
                </span>
                <span className="source-card__body">
                  <span className="source-card__title">Aus Galerie wählen</span>
                  <span className="source-card__hint">Foto oder Screenshot</span>
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
              disabled={busy || prepping || !hasInput || (usage ? !enoughLp : false)}
            >
              {busy ? (
                "KI erstellt deine Karten…"
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
    </>
  );
}
