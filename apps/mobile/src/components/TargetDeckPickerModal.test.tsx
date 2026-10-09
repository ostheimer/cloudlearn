import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Deck } from "../lib/api";

vi.mock("react-native", () => Object.fromEntries(
  ["Modal", "ScrollView", "Text", "TextInput", "TouchableOpacity", "View"].map(name => [name, name]),
));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("lucide-react-native", () => ({ X: () => null, Layers: () => null, Plus: () => null, Search: () => null }));
vi.mock("../theme", () => ({ useColors: () => ({}), spacing: {}, radius: {}, typography: {} }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ i18n: { language: "de" }, t: (key: string) => key }) }));
import TargetDeckPickerModal from "./TargetDeckPickerModal";

let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.unstubAllGlobals();
});
async function show(canCreateDeck: boolean) {
  const onCreateDeck = vi.fn();
  const onSelect = vi.fn();
  await act(async () => { renderer = create(
    <TargetDeckPickerModal visible cardCount={2} decks={[{ id: "full", title: "Biologie", cardCount: 100 } as Deck]}
      maxCardsPerDeck={100} canCreateDeck={canCreateDeck} onCreateDeck={onCreateDeck} onSelect={onSelect} onClose={() => {}} />,
  ); });
  return { onCreateDeck, onSelect };
}
describe("full target decks", () => {
  it("announces a full deck as disabled and provides a working new-deck exit", async () => {
    const { onCreateDeck, onSelect } = await show(true);
    const buttons = renderer.root.findAllByType("TouchableOpacity" as never);
    const full = buttons.find(button => button.props.disabled)!;
    expect(full.props.accessibilityState).toEqual({ disabled: true });
    const createDeck = buttons.find(button => button.props.accessibilityLabel === "Neues Deck")!;
    expect(createDeck).toBeDefined();
    await act(async () => createDeck.props.onPress());
    expect(onCreateDeck).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
  });
  it("does not offer a new deck when its plan limit is reached", async () => {
    await show(false);
    expect(renderer.root.findAllByType("TouchableOpacity" as never).some(button => button.props.accessibilityLabel === "Neues Deck")).toBe(false);
  });
});
