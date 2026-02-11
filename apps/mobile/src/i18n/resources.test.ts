import { describe, expect, it } from "vitest";
import { resources } from "./resources";

describe("i18n resources", () => {
  it("contains German default and English translation keys", () => {
    expect(resources.de.translation.loginTitle).toBeTypeOf("string");
    expect(resources.en.translation.loginTitle).toBeTypeOf("string");
    expect(resources.de.translation.scanTab).toBeTypeOf("string");
    expect(resources.en.translation.scanTab).toBeTypeOf("string");
  });
});
