import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  ...Object.fromEntries(["KeyboardAvoidingView", "Modal", "ScrollView", "Text", "TextInput", "TouchableOpacity", "View"].map(name => [name, name])),
  Platform: { OS: "ios" }, Alert: { alert: vi.fn() },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("lucide-react-native", () => ({ X: () => null, Check: () => null, AlertTriangle: () => null }));
vi.mock("../theme", () => ({ useColors: () => ({}), spacing: {}, radius: {}, typography: {} }));
import CardEditor from "./CardEditor";

let renderer: ReactTestRenderer;
const original = { front: "Frage", back: "Antwort", difficulty: "hard" };
const save = vi.fn();
async function show(saving = false, card = original, visible = true) {
  await act(async () => {
    // Learning screens construct a fresh card object on each parent render.
    const tree = <CardEditor visible={visible} card={{ ...card }} saving={saving} onSave={save} onCancel={() => {}} />;
    if (renderer) renderer.update(tree);
    else renderer = create(tree);
  });
}
function input(index: number) { return renderer.root.findAllByType("TextInput" as never)[index]!; }
function button(label: string) {
  return renderer.root.findAllByType("TouchableOpacity" as never).find(node =>
    node.findAllByType("Text" as never).some(text => text.children.join("") === label),
  )!;
}
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  save.mockReset();
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined as unknown as ReactTestRenderer;
  vi.unstubAllGlobals();
});
describe("learning card editor draft", () => {
  it("keeps entered text and difficulty while a save fails and retries the same draft", async () => {
    await show();
    await act(async () => {
      input(0).props.onChangeText("Geänderte Frage");
      input(1).props.onChangeText("Geänderte Antwort");
      button("Leicht").props.onPress();
    });
    await act(async () => button("Speichern").props.onPress());
    expect(save).toHaveBeenLastCalledWith({ front: "Geänderte Frage", back: "Geänderte Antwort", difficulty: "easy" });
    await show(true);
    await show(false);
    expect(input(0).props.value).toBe("Geänderte Frage");
    expect(input(1).props.value).toBe("Geänderte Antwort");
    await act(async () => button("Speichern").props.onPress());
    expect(save).toHaveBeenLastCalledWith({ front: "Geänderte Frage", back: "Geänderte Antwort", difficulty: "easy" });
  });
  it("loads the real difficulty and reloads the saved card when reopened", async () => {
    await show();
    await act(async () => button("Speichern").props.onPress());
    expect(save).toHaveBeenLastCalledWith(original);
    await act(async () => input(0).props.onChangeText("Verworfener Entwurf"));
    await show(false, original, false);
    await show();
    expect(input(0).props.value).toBe(original.front);
  });
});
