import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { runScanSourceAction } from "./scanSourceAction";

describe("Scan-Quellen: Kostenhilfe vor Dateiauswahl (#701)", () => {
  const scan = readFileSync(new URL("../../app/(tabs)/scan.tsx", import.meta.url), "utf8");
  const sourceButtons = scan.slice(scan.indexOf("{/* Input mode buttons */}"), scan.indexOf("{/* PDF import button */}") + 700);

  it("lässt unbezahlbare Quellen für die Kostenhilfe antippbar", () => {
    expect(sourceButtons).not.toMatch(/disabled=\{!afford\./);
  });

  it("prüft alle fünf Quellen vor Kamera, Picker oder Moduswechsel", () => {
    for (const call of [
      'selectSource("aiScan", lpCostAiScan, openCamera)',
      'selectSource("aiScan", lpCostAiScan, handlePickFromGallery)',
      'selectSource("aiScan", lpCostAiScan, () => setMode("text"))',
      'selectSource("urlImport", lpCostUrlImport, () => setMode("url"))',
      'selectSource("pdfImport", lpCostPdfImport, handlePickPdf)',
    ]) expect(sourceButtons.includes(call), call).toBe(true);
  });

  it("bewahrt die Sperre während Verarbeitung und Speicherung", () => {
    expect(scan).toContain("busy: loading || saving");
    expect(sourceButtons.match(/disabled=\{loading \|\| saving\}/g)).toHaveLength(5);
    expect(sourceButtons.match(/accessibilityRole="button"/g)).toHaveLength(5);
    expect(sourceButtons).not.toMatch(/opacity: afford\./);
  });

  it.each([15, 20])("erklärt bei 12 LP den Quellenpreis %i ohne Import oder Picker", (cost) => {
    const onContinue = vi.fn();
    const onInsufficient = vi.fn();
    runScanSourceAction({ balance: 12, cost, busy: false, onContinue, onInsufficient });
    expect(onContinue).not.toHaveBeenCalled();
    expect(onInsufficient).toHaveBeenCalledExactlyOnceWith(cost);
  });

  it.each([[12, 10], [15, 15], [20, 20], [8, 8]])("öffnet bei %i LP und Preis %i die Quelle", (balance, cost) => {
    const onContinue = vi.fn();
    const onInsufficient = vi.fn();
    runScanSourceAction({ balance, cost, busy: false, onContinue, onInsufficient });
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onInsufficient).not.toHaveBeenCalled();
  });

  it.each([0, 12, 100])("öffnet während laufender Arbeit auch bei %i LP nichts", (balance) => {
    const onContinue = vi.fn();
    const onInsufficient = vi.fn();
    runScanSourceAction({ balance, cost: 15, busy: true, onContinue, onInsufficient });
    expect(onContinue).not.toHaveBeenCalled();
    expect(onInsufficient).not.toHaveBeenCalled();
  });
});
