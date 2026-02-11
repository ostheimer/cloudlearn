import { create } from "zustand";

interface CaptureState {
  imageUri: string | null;
  setImageUri: (uri: string | null) => void;
}

export const useCaptureState = create<CaptureState>((set) => ({
  imageUri: null,
  setImageUri: (imageUri) => set({ imageUri })
}));
