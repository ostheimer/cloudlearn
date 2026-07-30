import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAutoPlaySpeed, saveAutoPlaySpeed } from "./autoplaySpeed";

const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    setItem: async (k: string, v: string) => void store.set(k, v),
    getItem: async (k: string) => store.get(k) ?? null,
    removeItem: async (k: string) => void store.delete(k),
  },
}));

beforeEach(() => store.clear());

describe("autoplaySpeed", () => {
  it("gibt 3 zurück, wenn nichts gespeichert ist", async () => {
    expect(await loadAutoPlaySpeed()).toBe(3);
  });

  it("speichert und lädt eine gültige Geschwindigkeit", async () => {
    await saveAutoPlaySpeed(10);
    expect(await loadAutoPlaySpeed()).toBe(10);
  });

  it("fällt bei einem ungültigen Wert auf 3 zurück", async () => {
    store.set("autoplay-speed", "7");
    expect(await loadAutoPlaySpeed()).toBe(3);
  });

  it("fällt bei kaputtem Inhalt auf 3 zurück", async () => {
    store.set("autoplay-speed", "nicht-die-zahl");
    expect(await loadAutoPlaySpeed()).toBe(3);
  });
});
