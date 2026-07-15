import { describe, expect, it } from "vitest";
import { photoImportCopy } from "./importPageCopy";

describe("web scan photo import copy", () => {
  it("sets a clear desktop expectation for the photo source", () => {
    expect(photoImportCopy.sourceTitle).toBe("Foto aufnehmen oder hochladen");
    expect(photoImportCopy.sourceHint).toContain("Computer");
    expect(photoImportCopy.emptyButton).toContain("hochladen");
    expect(photoImportCopy.helpText).toContain("Bildauswahl");
  });
});
