/** Shared source labels and processing copy for the web and mobile import flow. */
export const importCopy = {
  de: {
    cameraTitle: "Foto aufnehmen",
    cameraHint: "Lehrbuch, Tafel, Notizen",
    galleryTitle: "Bild wählen",
    galleryHint: "Foto oder Screenshot",
    textTitle: "Text eingeben",
    textHint: "Text tippen oder einfügen",
    urlTitle: "URL importieren",
    urlHint: "Webseite als Lernkarten",
    pdfTitle: "PDF importieren",
    pdfHint: "Skript, Handout, Zusammenfassung",
    info: "Die KI liest dein Material und erstellt automatisch Lernkarten aus Fotos, Text, Webseiten oder PDFs.",
    create: "Karten erstellen",
    processing: "Karten werden erstellt…",
    processingHint: "Das kann ein paar Sekunden dauern.",
    saving: "Karten werden gespeichert…",
    back: "Andere Quelle wählen",
    emptyLearn: "Scanne Lernmaterial, um Karten zu erstellen.",
    full: "voll",
    oneSpace: "1 Platz frei",
    spaces: "{{count}} Plätze frei",
  },
  en: {
    cameraTitle: "Take a photo",
    cameraHint: "Textbook, board, notes",
    galleryTitle: "Choose an image",
    galleryHint: "Photo or screenshot",
    textTitle: "Enter text",
    textHint: "Type or paste text",
    urlTitle: "Import URL",
    urlHint: "Webpage as flashcards",
    pdfTitle: "Import PDF",
    pdfHint: "Course notes, handout, summary",
    info: "AI reads your material and automatically creates flashcards from photos, text, webpages or PDFs.",
    create: "Create cards",
    processing: "Creating cards…",
    processingHint: "This may take a few seconds.",
    saving: "Saving cards…",
    back: "Choose another source",
    emptyLearn: "Scan study material to create cards.",
    full: "full",
    oneSpace: "1 space available",
    spaces: "{{count}} spaces available",
  },
} as const;

export function importDeckSpaceHint(free: number | null, language = "de"): string | null {
  if (free === null) return null;
  const copy = language.split("-")[0] === "en" ? importCopy.en : importCopy.de;
  if (free <= 0) return copy.full;
  return free === 1 ? copy.oneSpace : copy.spaces.replace("{{count}}", String(free));
}
