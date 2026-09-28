import type { Alert } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { resources } from "../i18n/resources";
import { createAiImportConsentGate, type AiImportSource } from "./aiImportConsent";

const translate = (key: string) => resources.de.translation[key as keyof typeof resources.de.translation];
function dialog() {
  const show = vi.fn<typeof Alert.alert>();
  const gate = createAiImportConsentGate();
  const choose = (index: number) => show.mock.calls.at(-1)?.[2]?.[index]?.onPress?.();
  const dismiss = () => show.mock.calls.at(-1)?.[3]?.onDismiss?.();
  return { show, gate, choose, dismiss };
}

describe("native AI transmission permission", () => {
  it.each<AiImportSource>(["photo", "pdf", "text", "url"])("discloses the recipient and purpose for %s; only explicit yes allows sending", async (source) => {
    const d = dialog();
    const decision = d.gate(source, translate, d.show);
    const call = d.show.mock.calls[0];
    if (!call) throw new Error("Expected a native permission dialog");
    const [title, message, buttons] = call;
    expect(title).toContain("Google Gemini");
    expect(message).toContain("Google Gemini");
    expect(message).toContain("Karteikarten");
    expect(buttons?.[0]?.text).toBe("Abbrechen");
    expect(buttons?.[1]?.text).toBe("Ja, an Google Gemini senden");
    d.choose(1);
    d.dismiss(); // Android dismissal following a button must not undo the choice.
    await expect(decision).resolves.toBe(true);
  });

  it("cancel and dismissal deny transmission, with a fresh choice on retry", async () => {
    const d = dialog();
    const cancelled = d.gate("photo", translate, d.show);
    d.choose(0);
    await expect(cancelled).resolves.toBe(false);
    const dismissed = d.gate("photo", translate, d.show);
    d.dismiss();
    await expect(dismissed).resolves.toBe(false);
    const retry = d.gate("photo", translate, d.show);
    d.choose(1);
    await expect(retry).resolves.toBe(true);
    expect(d.show).toHaveBeenCalledTimes(3);
  });

  it("a second tap cannot queue another send while permission is pending", async () => {
    const d = dialog();
    const pending = d.gate("pdf", translate, d.show);
    await expect(d.gate("pdf", translate, d.show)).resolves.toBe(false);
    expect(d.show).toHaveBeenCalledOnce();
    d.choose(1);
    await expect(pending).resolves.toBe(true);
    const next = d.gate("text", translate, d.show);
    expect(d.show).toHaveBeenCalledTimes(2);
    d.choose(0);
    await expect(next).resolves.toBe(false);
  });
});
