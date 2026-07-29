import { beforeEach, describe, expect, it } from "vitest";
import { useOcrEditorState } from "./ocrEditorState";

describe("ocrEditorState", () => {
  beforeEach(() => {
    useOcrEditorState.getState().reset();
  });

  it("lässt Tipp-Eingaben unangetastet — auch das Leerzeichen am Ende (#609)", () => {
    // Vorher normalisierte jeder Tastendruck: aus "Hund " wurde "Hund",
    // das nächste Zeichen klebte am Wort — zwei Wörter waren unmöglich.
    useOcrEditorState.getState().setEditedText("Die Mitochondrien ");
    expect(useOcrEditorState.getState().editedText).toBe("Die Mitochondrien ");
  });

  it("normalisiert weiterhin beim Setzen des OCR-Ergebnisses", () => {
    useOcrEditorState.getState().setOriginalText("  Ein   Text \n\n\n mit  Lücken  ");
    expect(useOcrEditorState.getState().originalText).toBe("Ein Text \n\n mit Lücken");
    expect(useOcrEditorState.getState().editedText).toBe("Ein Text \n\n mit Lücken");
  });
});
