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
vi.mock("expo-document-picker", () => ({}));
vi.mock("lucide-react-native", () => Object.fromEntries([
  "Camera", "CheckCircle2", "FileText", "ImageIcon", "PenLine", "Lightbulb", "Save", "RotateCcw",
  "Sparkles", "ChevronRight", "Link2", "ArrowLeft", "Zap", "Layers", "Trash2", "Plus", "GripVertical",
].map(name => [name, () => null])));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => resources[mocks.language].translation[key as keyof typeof resources.de.translation] ?? key }) }));
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
  listCardsInDeck: mocks.listCardsInDeck, listDecks: mocks.listDecks, getLpBalance: vi.fn(),
}));
vi.mock("./scanDraft", () => ({ loadScanDraft: mocks.loadScanDraft, saveScanDraft: mocks.saveScanDraft, clearScanDraft: mocks.clearScanDraft }));
vi.mock("../../lib/aiImportConsent", () => ({ createAiImportConsentGate: () => async () => true }));
vi.mock("../../components/LpInsufficientModal", () => ({ LpInsufficientModal: () => null }));
vi.mock("../../components/TargetDeckPickerModal", () => ({ default: () => null }));
vi.mock("../../components/AuthPromptCard", () => ({ AuthPromptCard: () => null }));
vi.mock("../../components/LpBadge", () => ({ LpBadge: () => null }));
import ScanScreen from "../../../app/(tabs)/scan";

let renderer: ReactTestRenderer;
async function show(focused: boolean) {
  await act(async () => {
    const tree = <Focus.Provider value={focused}><ScanScreen /></Focus.Provider>;
    if (renderer) renderer.update(tree); else renderer = create(tree);
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
async function generatePhoto() {
  await press("Bild wählen");
  expect(text(renderer.root)).toContain("1 Karte erstellt");
}
async function save() {
  await press("Karten speichern");
  const choices = mocks.alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
  await act(async () => choices.find(c => c.text === "Neues Deck")!.onPress!());
  expect(text(renderer.root)).toContain("1 Karten gespeichert");
}
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mocks.language = "de";
  useOcrEditorState.getState().reset();
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
