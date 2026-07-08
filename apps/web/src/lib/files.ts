/**
 * Browser-Helfer für die KI-Import-Datei-Quellen (Foto, PDF).
 * Läuft ausschließlich im Client (FileReader, canvas, createImageBitmap).
 */

/** Liest eine Datei als „nacktes" base64 (ohne data-URI-Präfix) — passend zum API-Vertrag. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.onload = () => {
      const s = String(reader.result);
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.readAsDataURL(file);
  });
}

export interface PreparedImage {
  /** base64 ohne data-URI-Präfix, immer als JPEG kodiert */
  base64: string;
  /** data-URL für die Vorschau */
  previewUrl: string;
}

/**
 * Verkleinert ein Bild (längste Kante auf maxDim) und kodiert es als JPEG.
 * Dadurch bleibt die Anfrage klein genug (Vercel ~4,5 MB) und wir schicken
 * immer image/jpeg — kein HEIC/PNG/WebP auf der Leitung. EXIF-Drehung wird
 * berücksichtigt, damit Handy-Fotos aufrecht ankommen.
 */
export async function compressImageToJpeg(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas nicht verfügbar.");
    ctx.drawImage(bitmap, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), previewUrl: dataUrl };
  } finally {
    bitmap.close();
  }
}
