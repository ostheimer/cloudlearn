import { create } from "zustand";
import { normalizeOcrText } from "./normalizeOcrText";

interface OcrEditorState {
  originalText: string;
  editedText: string;
  setOriginalText: (text: string) => void;
  setEditedText: (text: string) => void;
  reset: () => void;
}

export const useOcrEditorState = create<OcrEditorState>((set) => ({
  originalText: "",
  editedText: "",
  setOriginalText: (text) => {
    const normalized = normalizeOcrText(text);
    set({ originalText: normalized, editedText: normalized });
  },
  // Beim TIPPEN unverändert speichern (#609): Die Normalisierung schluckte
  // nach jedem Tastendruck das Leerzeichen am Ende — man konnte keine zwei
  // Wörter schreiben. Aufgeräumt wird erst beim Absenden (scanPayload bzw.
  // handleGenerateFromText), wo es keinen Cursor mehr stört.
  setEditedText: (text) => set({ editedText: text }),
  reset: () => set({ originalText: "", editedText: "" })
}));
