import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAiImportConsentGate } from "./aiImportConsent";

afterEach(() => vi.unstubAllGlobals());

// Execute the real screen handlers without a React Native renderer. Only their
// network, dialog and UI dependencies are substituted; no request is sent.
const source = ts.createSourceFile(
  "scan.tsx",
  readFileSync(new URL("../../app/(tabs)/scan.tsx", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
function handler(name: string, context: Record<string, unknown>) {
  let expression: string | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      expression = node.initializer?.getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!expression) throw new Error(`Missing import handler: ${name}`);
  const compiled = ts.transpileModule(`(${expression})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return runInNewContext(compiled, context) as (...args: unknown[]) => Promise<void>;
}

const imports = [
  { name: "processImage", kind: "photo", api: "scanImage", args: ["local-photo", "image/jpeg"] },
  { name: "processPdf", kind: "pdf", api: "importPdf", args: ["local-pdf", "Lernblatt.pdf"] },
  { name: "handleGenerateFromText", kind: "text", api: "scanText", args: [] },
  { name: "handleGenerateFromUrl", kind: "url", api: "importFromUrl", args: [] },
] as const;
function setup(allow: boolean) {
  const result = { cards: [], fileName: "Lernblatt.pdf", pageCount: 1, usage: { lpSpent: 10, lpBalance: 90 } };
  const context: Record<string, unknown> = {
    userId: "test-user", editedText: "Neutrales Lernmaterial", sourceUrl: "https://example.invalid/lernblatt",
    lpCostAiScan: 10, lpCostPdfImport: 20, lpCostUrlImport: 15,
    t: (key: string) => key, Alert: { alert: vi.fn() },
    confirmAiImport: vi.fn(async () => allow),
    normalizeOcrText: (text: string) => text.trim(), isHttpUrl: () => true,
    getImportAttemptKey: vi.fn(() => "attempt-1"), shouldOpenLpModal: () => false,
    IMPORT_ERROR_TITLE_KEY: "import.errorTitle", importErrorKey: () => "import.failed",
    scanImage: vi.fn(async () => result), importPdf: vi.fn(async () => result),
    scanText: vi.fn(async () => result), importFromUrl: vi.fn(async () => result),
  };
  for (const setter of ["setLoading", "setCards", "setSaved", "setSourceUrl", "setPdfFileName", "setPdfPageCount", "setImageUri", "setImageBase64", "setFallbackUsed", "setDeckTitle", "deductLp", "setUsage", "setLpModalFeature", "setLpModalCost", "setLpModalVisible"]) context[setter] = vi.fn();
  return context;
}

describe("AI imports require permission before transmission", () => {
  it.each(imports)("the browser choice gates the real $kind handler on cancel and accept", async ({ name, api, args }) => {
    const c = setup(true);
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("window", { confirm });
    c.confirmAiImport = createAiImportConsentGate("web");
    const run = handler(name, c);
    await run(...args);
    expect(c[api]).not.toHaveBeenCalled();
    expect(c.deductLp).not.toHaveBeenCalled();
    await run(...args);
    expect(c[api]).toHaveBeenCalledOnce();
    expect(c.deductLp).toHaveBeenCalledExactlyOnceWith(10);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect((c.Alert as { alert: unknown }).alert).not.toHaveBeenCalled();
  });

  it.each(imports)("the native dialog gates the real $kind handler on cancel and accept", async ({ name, api, args }) => {
    const c = setup(true);
    const alert = vi.fn();
    c.Alert = { alert };
    c.confirmAiImport = createAiImportConsentGate();
    const run = handler(name, c);
    const cancelled = run(...args);
    expect(c[api]).not.toHaveBeenCalled();
    alert.mock.calls[0]?.[2][0].onPress();
    await cancelled;
    expect(c[api]).not.toHaveBeenCalled();
    const accepted = run(...args);
    expect(c[api]).not.toHaveBeenCalled();
    alert.mock.calls[1]?.[2][1].onPress();
    await accepted;
    expect(c[api]).toHaveBeenCalledOnce();
    expect(c.deductLp).toHaveBeenCalledExactlyOnceWith(10);
  });

  it.each(imports)("cancel $kind does not call any import API or spend LP", async ({ name, kind, args }) => {
    const c = setup(false);
    await handler(name, c)(...args);
    expect(c.confirmAiImport).toHaveBeenCalledWith(kind, c.t, (c.Alert as { alert: unknown }).alert);
    for (const method of ["scanImage", "importPdf", "scanText", "importFromUrl"]) expect(c[method]).not.toHaveBeenCalled();
    expect(c.deductLp).not.toHaveBeenCalled();
    expect(c.setCards).not.toHaveBeenCalled();
    expect(c.setLoading).not.toHaveBeenCalled();
  });

  it.each(imports)("waits for $kind permission before sending", async ({ name, api, args }) => {
    const c = setup(true);
    let resolve!: (allow: boolean) => void;
    c.confirmAiImport = vi.fn(() => new Promise<boolean>((done) => { resolve = done; }));
    const pending = handler(name, c)(...args);
    expect(c[api]).not.toHaveBeenCalled();
    resolve(true);
    await pending;
    expect(c[api]).toHaveBeenCalledOnce();
    expect(c.deductLp).toHaveBeenCalledExactlyOnceWith(10);
    expect(c.setLoading).toHaveBeenLastCalledWith(false);
  });

  it.each(imports)("reconfirms a failed $kind request; cancelling retry sends nothing", async ({ name, api, args }) => {
    const c = setup(true);
    (c[api] as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("offline"));
    (c.confirmAiImport as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const run = handler(name, c);
    await run(...args);
    expect(c[api]).toHaveBeenCalledTimes(1);
    expect(c.deductLp).not.toHaveBeenCalled();
    await run(...args);
    expect(c[api]).toHaveBeenCalledTimes(1);
    await run(...args);
    expect(c[api]).toHaveBeenCalledTimes(2);
    expect(c.confirmAiImport).toHaveBeenCalledTimes(3);
    expect(c.deductLp).toHaveBeenCalledExactlyOnceWith(10);
  });
});
