import { describe, expect, it } from "vitest";
import { normalizeOcrText } from "./normalizeOcrText";

describe("normalizeOcrText", () => {
  it("normalizes line breaks and spaces", () => {
    const input = "Ein   Text\r\n\r\nmit   vielen \n\n\n Abstaenden";
    const output = normalizeOcrText(input);
    expect(output).toBe("Ein Text\n\nmit vielen \n\n Abstaenden");
  });
});
