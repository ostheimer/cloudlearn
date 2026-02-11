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
  setEditedText: (text) => set({ editedText: normalizeOcrText(text) }),
  reset: () => set({ originalText: "", editedText: "" })
}));
