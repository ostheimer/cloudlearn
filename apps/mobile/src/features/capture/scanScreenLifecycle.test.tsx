import React, { createContext, useContext, useEffect } from "react";
import { act, create, type ReactTestRenderer, type ReactTestInstance } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resources } from "../../i18n/resources";
import { useOcrEditorState } from "../ocr/ocrEditorState";

const mocks = vi.hoisted(() => ({
  language: "de" as "de" | "en",
  alert: vi.fn(), push: vi.fn(), scanImage: vi.fn(), createDeck: vi.fn(), createCard: vi.fn(),
  listCardsInDeck: vi.fn(), listDecks: vi.fn(), loadScanDraft: vi.fn(), saveScanDraft: vi.fn(),
  clearScanDraft: vi.fn(), setUsage: vi.fn(), deductLp: vi.fn(),
  getLpBalance: vi.fn(), pickPdf: vi.fn(), importPdf: vi.fn(), takePicture: vi.fn(), consent: vi.fn(),
}));
const Focus = createContext(true);
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: mocks.push }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    const focused = useContext(Focus);
    useEffect(() => focused ? effect() : undefined, [focused, effect]);
  },
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator", Image: "Image", ScrollView: "ScrollView",
  Text: "Text", TextInput: "TextInput", TouchableOpacity: "TouchableOpacity", View: "View",
  Alert: { alert: mocks.alert }, Platform: { OS: "ios" },
  Animated: { Value: class { setValue() {} }, View: "View" },
  PanResponder: { create: () => ({ panHandlers: {} }) },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("expo-camera", () => ({ CameraView: "CameraView", useCameraPermissions: () => [{ granted: true }, vi.fn()] }));
vi.mock("expo-image-picker", () => ({
  MediaTypeOptions: { Images: "Images" },
  launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: "test-photo.jpg", base64: "photo", width: 400, height: 600 }] }),
}));
vi.mock("expo-image-manipulator", () => ({ SaveFormat: { JPEG: "jpeg" }, manipulateAsync: async () => ({ uri: "small-photo.jpg", base64: "photo" }) }));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: mocks.pickPdf }));
vi.mock("lucide-react-native", () => Object.fromEntries([
  "Camera", "CheckCircle2", "FileText", "ImageIcon", "PenLine", "Lightbulb", "Save", "RotateCcw",
  "Sparkles", "ChevronRight", "Link2", "ArrowLeft", "Zap", "Layers", "Trash2", "Plus", "GripVertical",
].map(name => [name, () => null])));
function translate(key: string, values: Record<string, unknown> = {}) {
  const value = resources[mocks.language].translation[key as keyof typeof resources.de.translation] ?? key;
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values[name] ?? `{{${name}}}`));
}
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: translate }) }));
vi.mock("../../theme", () => ({ useColors: () => ({}), spacing: {}, radius: {}, typography: {}, shadows: {} }));
vi.mock("../../store/sessionStore", () => ({ useSessionStore: (select: (s: { userId: string }) => unknown) => select({ userId: "local-test" }) }));
vi.mock("../../store/usageStore", () => ({
  useUsageStore: (select: (s: Record<string, unknown>) => unknown) => select({
    setUsage: mocks.setUsage, deductLp: mocks.deductLp, lpBalance: 400,
    lpCostAiScan: 10, lpCostUrlImport: 10, lpCostPdfImport: 10, tier: "pro", maxDecks: 100, maxCardsPerDeck: 100,
  }), usageFromBalanceResponse: vi.fn(),
}));
vi.mock("../../lib/api", () => ({
  scanImage: mocks.scanImage, createDeck: mocks.createDeck, createCard: mocks.createCard,
  listCardsInDeck: mocks.listCardsInDeck, listDecks: mocks.listDecks, getLpBalance: mocks.getLpBalance, importPdf: mocks.importPdf,
}));
vi.mock("./scanDraft", () => ({ loadScanDraft: mocks.loadScanDraft, saveScanDraft: mocks.saveScanDraft, clearScanDraft: mocks.clearScanDraft }));
vi.mock("../../lib/aiImportConsent", () => ({ createAiImportConsentGate: () => mocks.consent }));
vi.mock("../../components/LpInsufficientModal", () => ({ LpInsufficientModal: () => null }));
vi.mock("../../components/TargetDeckPickerModal", () => ({ default: () => null }));
vi.mock("../../components/AuthPromptCard", () => ({ AuthPromptCard: () => null }));
vi.mock("../../components/LpBadge", () => ({ LpBadge: () => null }));
import ScanScreen from "../../../app/(tabs)/scan";

let renderer: ReactTestRenderer;
async function show(focused: boolean) {
  await act(async () => {
    const tree = <Focus.Provider value={focused}><ScanScreen /></Focus.Provider>;
    if (renderer) renderer.update(tree); else renderer = create(tree, { createNodeMock: (element) => element.type === "CameraView" ? { takePictureAsync: mocks.takePicture } : null });
  });
}
function text(node: ReactTestInstance): string {
  return node.children.map(child => typeof child === "string" ? child : text(child)).join("");
}
function button(label: string) {
  return renderer.root.findAllByType("TouchableOpacity" as never).find(node => text(node).includes(label))!;
}
async function press(label: string) {
  await act(async () => button(label).props.onPress());
}
async function beginPress(label: string) {
  let done: Promise<void>;
  await act(async () => { done = button(label).props.onPress(); });
  return { done: done! };
}
async function generatePhoto() {
  const { done: generating } = await beginPress(translate("scan.galleryTitle"));
  if (mocks.alert.mock.calls.at(-1)?.[0] === translate("scan.costTitle")) await answer("scan.costConfirm");
  await act(async () => { await generating; });
  expect(text(renderer.root)).toContain("1 Karte erstellt");
}
async function save() {
  await press("Karten speichern");
  const choices = mocks.alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
  await act(async () => choices.find(c => c.text === "Neues Deck")!.onPress!());
  expect(text(renderer.root)).toContain("1 Karten gespeichert");
}
async function answer(label: string) {
  const choices = mocks.alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
  await act(async () => choices.find(c => c.text === translate(label))!.onPress?.());
}
function input(label: string) {
  return renderer.root.findAllByType("TextInput" as never).find(n => n.props.accessibilityLabel === translate(label))!;
}
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mocks.language = "de";
  useOcrEditorState.getState().reset();
  mocks.consent.mockResolvedValue(true);
  mocks.getLpBalance.mockResolvedValue({ lpBalance: 400, lpCostAiScan: 17, lpCostPdfImport: 29 });
  mocks.pickPdf.mockResolvedValue({ canceled: false, assets: [{ name: "notes.pdf", uri: "local.pdf", size: 1000, base64: "a".repeat(1000) }] });
  mocks.takePicture.mockResolvedValue({ uri: "photo.jpg", base64: "photo" });
  mocks.importPdf.mockResolvedValue({ cards: [{ front: "PDF question", back: "PDF answer", type: "basic", tags: [] }], deckTitle: "PDF-Test", fileName: "notes.pdf", pageCount: 1, fallbackUsed: false });
  mocks.loadScanDraft.mockResolvedValue(null);
  mocks.listDecks.mockResolvedValue({ decks: [] });
  mocks.listCardsInDeck.mockResolvedValue({ cards: [] });
  mocks.createDeck.mockResolvedValue({ deck: { id: "saved-deck", title: "Foto-Test" } });
  mocks.createCard.mockResolvedValue({});
  mocks.scanImage.mockResolvedValue({ cards: [{ front: "Was ist Aufbaumen?", back: "Auf einen Baum fliegen", type: "basic", difficulty: "easy", tags: [] }], deckTitle: "Foto-Test", fallbackUsed: false });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined as unknown as ReactTestRenderer;
  vi.unstubAllGlobals();
});

describe("mounted Scan tab lifecycle", () => {
  it.each([
    { language: "de" as const, image: "Bild wählen", entry: "Text eingeben", back: "Andere Quelle wählen", create: "Karten erstellen" },
    { language: "en" as const, image: "Choose an image", entry: "Enter text", back: "Choose another source", create: "Create cards" },
  ])("renders the source and input controls in $language", async ({ language, image, entry, back, create }) => {
    mocks.language = language;
    await show(true);
    expect(button(image)).toBeDefined();
    expect(text(renderer.root)).toContain(resources[language].translation["scan.info"]);
    await press(entry);
    expect(button(back)).toBeDefined();
    expect(text(renderer.root)).toContain(create);
    await press(back);
    expect(button(image)).toBeDefined();
  });

  it("shows a new scan after saving, learning and returning, even if the deck was deleted", async () => {
    await show(true);
    await generatePhoto();
    await save();
    // A save rerender must retain success and its navigation actions until leaving.
    expect(button("Jetzt lernen")).toBeDefined();
    await press("Jetzt lernen");
    expect(mocks.push).toHaveBeenCalledWith({ pathname: "/deck-review/[id]", params: { id: "saved-deck", title: "Foto-Test" } });
    await show(false);
    // Library deletes the deck while Scan remains mounted under another route.
    mocks.listDecks.mockResolvedValue({ decks: [] });
    const readsBeforeReturn = mocks.listDecks.mock.calls.length;
    await show(true);
    expect(text(renderer.root)).toContain("Lernmaterial erfassen");
    expect(button("Bild wählen")).toBeDefined();
    expect(text(renderer.root)).not.toContain("Karten gespeichert");
    expect(text(renderer.root)).not.toContain("Foto-Test");
    expect(renderer.root.findAllByType("Image" as never)).toHaveLength(0);
    expect(mocks.listDecks).toHaveBeenCalledTimes(readsBeforeReturn + 1);
    expect(mocks.scanImage).toHaveBeenCalledTimes(1);
    expect(mocks.createDeck).toHaveBeenCalledTimes(1);
    expect(mocks.createCard).toHaveBeenCalledTimes(1);
  });

  it.each(["Deck öffnen", null])("clears the saved result after leaving via %s", async (destination) => {
    await show(true);
    await generatePhoto();
    await save();
    if (destination) await press(destination);
    await show(false);
    await show(true);
    expect(text(renderer.root)).toContain("Lernmaterial erfassen");
    expect(text(renderer.root)).not.toContain("Karten gespeichert");
    expect(button("Bild wählen")).toBeDefined();
  });

  it("preserves unsaved paid preview cards across tab changes", async () => {
    await show(true);
    await generatePhoto();
    await show(false);
    await show(true);
    expect(text(renderer.root)).toContain("1 Karte erstellt");
    expect(renderer.root.findAllByType("TextInput" as never).some(input => input.props.value === "Was ist Aufbaumen?")).toBe(true);
    expect(button("Karten speichern")).toBeDefined();
    expect(mocks.scanImage).toHaveBeenCalledTimes(1);
  });

  it("preserves text input across tab changes", async () => {
    await show(true);
    await press("Text eingeben");
    await act(async () => useOcrEditorState.getState().setEditedText("Meine ungespeicherten Notizen"));
    await show(false);
    await show(true);
    expect(renderer.root.findAllByType("TextInput" as never).some(input => input.props.value === "Meine ungespeicherten Notizen")).toBe(true);
  });

  it("retains partial-save retry state across tab changes without making a second deck", async () => {
    await show(true);
    await generatePhoto();
    mocks.createCard.mockRejectedValueOnce(new Error("offline"));
    await press("Karten speichern");
    const choices = mocks.alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
    await act(async () => choices.find(c => c.text === "Neues Deck")!.onPress!());
    await show(false);
    await show(true);
    expect(text(renderer.root)).toContain("1 Karte erstellt");
    await save();
    expect(mocks.createDeck).toHaveBeenCalledTimes(1);
  });

  it("starts fresh when a save completes while the Scan tab is blurred", async () => {
    await show(true);
    await generatePhoto();
    let complete!: () => void;
    mocks.createCard.mockReturnValueOnce(new Promise<void>(resolve => { complete = resolve; }));
    await press("Karten speichern");
    const choices = mocks.alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
    await act(async () => choices.find(c => c.text === "Neues Deck")!.onPress!());
    await show(false);
    await act(async () => complete());
    await show(true);
    expect(text(renderer.root)).toContain("Lernmaterial erfassen");
    expect(text(renderer.root)).not.toContain("Karten gespeichert");
  });

  it("still allows an explicit new scan immediately after successful save", async () => {
    await show(true);
    await generatePhoto();
    await save();
    await press("Neuen Scan starten");
    expect(text(renderer.root)).toContain("Lernmaterial erfassen");
    expect(text(renderer.root)).not.toContain("Karten gespeichert");
  });
});


describe("#733 paid imports and preview safety", () => {
  it.each(["Bild wählen", "PDF importieren", "camera"])("confirms live /usage costs before %s can send anything", async (source) => {
    await show(true);
    if (source === "camera") await press("Foto aufnehmen");
    let running: Promise<void>;
    if (source === "camera") {
      await act(async () => { running = renderer.root.findByType("CameraView" as never).findAllByType("TouchableOpacity" as never)[0]!.props.onPress(); });
    } else {
      running = (await beginPress(source)).done;
    }
    expect(mocks.getLpBalance).toHaveBeenCalledOnce();
    expect(mocks.alert.mock.calls.at(-1)?.[0]).toBe(translate("scan.costTitle"));
    expect(mocks.alert.mock.calls.at(-1)?.[1]).toContain(`${source === "PDF importieren" ? 29 : 17} LP`);
    expect(mocks.scanImage).not.toHaveBeenCalled();
    expect(mocks.importPdf).not.toHaveBeenCalled();
    expect(mocks.consent).not.toHaveBeenCalled();
    await answer("scan.costCancel");
    await act(async () => { await running!; });
    expect(mocks.deductLp).not.toHaveBeenCalled();
    expect(mocks.scanImage).not.toHaveBeenCalled();
    expect(mocks.importPdf).not.toHaveBeenCalled();
  });

  it("retains Gemini consent after cost approval and never sends if it is declined", async () => {
    await show(true);
    mocks.consent.mockResolvedValue(false);
    const { done: running } = await beginPress("Bild wählen");
    await answer("scan.costConfirm");
    await act(async () => { await running!; });
    expect(mocks.consent).toHaveBeenCalledOnce();
    expect(mocks.scanImage).not.toHaveBeenCalled();
    expect(mocks.deductLp).not.toHaveBeenCalled();
  });

  it("does not guess costs or send when /usage is unavailable", async () => {
    await show(true);
    mocks.getLpBalance.mockRejectedValue(new Error("offline"));
    await press("Bild wählen");
    expect(mocks.alert.mock.calls.at(-1)?.[1]).toBe(translate("scan.costUnavailable"));
    expect(mocks.scanImage).not.toHaveBeenCalled();
    expect(mocks.deductLp).not.toHaveBeenCalled();
  });

  it("edits and persists the proposed title, then saves its trimmed value", async () => {
    await show(true);
    await generatePhoto();
    expect(input("scan.previewTitle")).toBeDefined();
    await act(async () => input("scan.previewTitle").props.onChangeText("  Geänderte Überschrift  "));
    expect(mocks.saveScanDraft.mock.calls.at(-1)?.[0].deckTitle).toBe("  Geänderte Überschrift  ");
    await save();
    expect(mocks.createDeck).toHaveBeenCalledWith("local-test", "Geänderte Überschrift", ["scan", "auto"]);
  });

  it("keeps the last paid card until explicitly discarded", async () => {
    await show(true);
    await generatePhoto();
    const deletion = renderer.root.findAllByType("TouchableOpacity" as never).find(n => n.props.accessibilityLabel === "Karte 1 löschen")!;
    await act(async () => deletion.props.onPress());
    expect(mocks.alert.mock.calls.at(-1)?.[0]).toBe(translate("scan.lastCardTitle"));
    expect(text(renderer.root)).toContain("1 Karte erstellt");
    expect(mocks.clearScanDraft).not.toHaveBeenCalled();
    await answer("scan.keepLastCard");
    expect(text(renderer.root)).toContain("1 Karte erstellt");
    await act(async () => deletion.props.onPress());
    await answer("scan.discardLastCard");
    expect(text(renderer.root)).not.toContain("1 Karte erstellt");
    expect(mocks.clearScanDraft).toHaveBeenCalledOnce();
  });

  it.each([
    { size: 3_000_001, base64: "small" },
    { size: undefined, base64: "a".repeat(4_000_001) },
    { size: 100, base64: "a".repeat(4_000_001) },
  ])("rejects oversized PDF before confirmation, transmission or spending", async (asset) => {
    await show(true);
    mocks.pickPdf.mockResolvedValue({ canceled: false, assets: [{ uri: "local.pdf", name: "large.pdf", ...asset }] });
    await press("PDF importieren");
    expect(mocks.alert.mock.calls.at(-1)?.[1]).toBe(translate("scan.pdfTooLarge"));
    expect(mocks.getLpBalance).not.toHaveBeenCalled();
    expect(mocks.importPdf).not.toHaveBeenCalled();
    expect(mocks.deductLp).not.toHaveBeenCalled();
  });
});


describe("#733 boundaries and repeated taps", () => {
  it("allows a PDF exactly at the 3 MB limit after both approvals", async () => {
    await show(true);
    mocks.pickPdf.mockResolvedValue({ canceled: false, assets: [{ name: "boundary.pdf", uri: "local.pdf", size: 3_000_000, base64: "a".repeat(4_000_000) }] });
    const { done } = await beginPress("PDF importieren");
    await answer("scan.costConfirm");
    await act(async () => { await done; });
    expect(mocks.importPdf).toHaveBeenCalledOnce();
    expect(mocks.importPdf.mock.calls[0]?.at(-1)).toBe(true);
    expect(mocks.consent).toHaveBeenCalledOnce();
    expect(text(renderer.root)).toContain("1 Karte erstellt");
  });

  it("does not duplicate the cost dialog or import on a repeated source tap", async () => {
    await show(true);
    const repeatedTap = button("Bild wählen").props.onPress;
    const { done } = await beginPress("Bild wählen");
    await act(async () => { await repeatedTap(); });
    expect(mocks.getLpBalance).toHaveBeenCalledOnce();
    expect(mocks.alert).toHaveBeenCalledOnce();
    await answer("scan.costConfirm");
    await act(async () => { await done; });
    expect(mocks.scanImage).toHaveBeenCalledOnce();
    expect(mocks.deductLp).toHaveBeenCalledWith(17);
  });

  it("uses a default title for a whitespace-only edit", async () => {
    await show(true);
    await generatePhoto();
    await act(async () => input("scan.previewTitle").props.onChangeText("  "));
    await save();
    expect(mocks.createDeck.mock.calls[0]?.[1]).toMatch(/^Scan /);
  });

  it("retains edited title and card text when leaving and resuming the preview", async () => {
    await show(true);
    await generatePhoto();
    await act(async () => {
      input("scan.previewTitle").props.onChangeText("Ökologie");
      renderer.root.findAllByType("TextInput" as never).find(n => n.props.value === "Was ist Aufbaumen?")!.props.onChangeText("Geänderte Frage");
    });
    await show(false);
    await show(true);
    expect(input("scan.previewTitle").props.value).toBe("Ökologie");
    expect(mocks.saveScanDraft.mock.calls.at(-1)?.[0]).toMatchObject({ deckTitle: "Ökologie", cards: [{ front: "Geänderte Frage" }] });
    await save();
    expect(mocks.createCard.mock.calls[0]?.[2].front).toBe("Geänderte Frage");
  });

  it("removes an ordinary card without warning but protects the remaining card", async () => {
    await show(true);
    mocks.scanImage.mockResolvedValue({ cards: [{ front: "A", back: "B" }, { front: "C", back: "D" }], deckTitle: "Two cards", fallbackUsed: false });
    const { done } = await beginPress("Bild wählen");
    await answer("scan.costConfirm");
    await act(async () => { await done; });
    const deleteFirst = () => renderer.root.findAllByType("TouchableOpacity" as never).find(n => n.props.accessibilityLabel === "Karte 1 löschen")!;
    mocks.alert.mockClear();
    await act(async () => deleteFirst().props.onPress());
    expect(mocks.alert).not.toHaveBeenCalled();
    expect(text(renderer.root)).toContain("1 Karte erstellt");
    await act(async () => deleteFirst().props.onPress());
    expect(mocks.alert.mock.calls[0]?.[0]).toBe(translate("scan.lastCardTitle"));
  });

  it("rechecks affordability against the refreshed price before offering confirmation", async () => {
    await show(true);
    mocks.getLpBalance.mockResolvedValue({ lpBalance: 16, lpCostAiScan: 17, lpCostPdfImport: 29 });
    await press("Bild wählen");
    expect(mocks.scanImage).not.toHaveBeenCalled();
    expect(mocks.consent).not.toHaveBeenCalled();
    expect(mocks.alert).not.toHaveBeenCalled();
  });
});


describe("#733 localized controls after #760 integration", () => {
  it.each(["de", "en"] as const)("shows translated cost, title, deletion and PDF preflight controls in %s", async (language) => {
    mocks.language = language;
    await show(true);
    const { done } = await beginPress(translate("scan.galleryTitle"));
    expect(mocks.alert.mock.calls.at(-1)?.[0]).toBe(translate("scan.costTitle"));
    expect(mocks.alert.mock.calls.at(-1)?.[1]).toBe(translate("scan.costBody", { cost: 17, balance: 400 }));
    await answer("scan.costConfirm");
    await act(async () => { await done; });
    expect(input("scan.previewTitle").props.placeholder).toBe(translate("scan.previewTitlePlaceholder"));
    await act(async () => input("scan.previewTitle").props.onChangeText("Ökologie"));
    const deletion = renderer.root.findAllByType("TouchableOpacity" as never).find(n => n.props.accessibilityLabel === "Karte 1 löschen")!;
    await act(async () => deletion.props.onPress());
    expect(mocks.alert.mock.calls.at(-1)?.[0]).toBe(translate("scan.lastCardTitle"));
    expect(mocks.alert.mock.calls.at(-1)?.[1]).toBe(translate("scan.lastCardBody"));
    await answer("scan.keepLastCard");
    expect(input("scan.previewTitle").props.value).toBe("Ökologie");
    await act(async () => deletion.props.onPress());
    await answer("scan.discardLastCard");
    mocks.pickPdf.mockResolvedValue({ canceled: false, assets: [{ uri: "large.pdf", name: "large.pdf", size: 3_000_001 }] });
    await press(translate("scan.pdfTitle"));
    expect(mocks.alert.mock.calls.at(-1)?.[1]).toBe(translate("scan.pdfTooLarge"));
    expect(mocks.importPdf).not.toHaveBeenCalled();
  });
});
