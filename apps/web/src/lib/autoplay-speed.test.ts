import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAutoPlaySpeed, saveAutoPlaySpeed } from "./autoplay-speed";

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("autoplay-speed", () => {
  it("gibt 3 zurück, wenn nichts gespeichert ist", () => {
    stubLocalStorage();
    expect(loadAutoPlaySpeed()).toBe(3);
  });

  it("speichert und lädt eine gültige Geschwindigkeit", () => {
    stubLocalStorage();
    saveAutoPlaySpeed(10);
    expect(loadAutoPlaySpeed()).toBe(10);
  });

  it("fällt bei einem ungültigen Wert auf 3 zurück", () => {
    stubLocalStorage({ "clearn:autoplay-speed": "7" });
    expect(loadAutoPlaySpeed()).toBe(3);
  });

  it("fällt bei kaputtem Inhalt auf 3 zurück", () => {
    stubLocalStorage({ "clearn:autoplay-speed": "nicht-die-zahl" });
    expect(loadAutoPlaySpeed()).toBe(3);
  });
});
