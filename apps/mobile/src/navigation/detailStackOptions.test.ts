import { describe, expect, it } from "vitest";
import { createDetailStackOptions } from "./detailStackOptions";

describe("createDetailStackOptions", () => {
  it("always enables header visibility for detail screens", () => {
    const options = createDetailStackOptions({
      title: "Jaegersprache",
      backTitle: "Bibliothek",
      colors: {
        primary: "#5b5af5",
        background: "#0a0f2a",
      },
    });

    expect(options.headerShown).toBe(true);
  });

  it("maps title, back title and theme colors", () => {
    const options = createDetailStackOptions({
      title: "Biologie",
      backTitle: "Decks",
      colors: {
        primary: "#123456",
        background: "#abcdef",
      },
    });

    expect(options.title).toBe("Biologie");
    expect(options.headerBackTitle).toBe("Decks");
    expect(options.headerTintColor).toBe("#123456");
    expect(options.headerStyle).toEqual({ backgroundColor: "#abcdef" });
  });
});
