import { describe, expect, it } from "vitest";
import { GENDERS, validateGender } from "../services/genderService";

describe("validateGender", () => {
  it("akzeptiert genau die bekannten Werte", () => {
    for (const gender of GENDERS) {
      expect(validateGender(gender)).toEqual({ ok: true, value: gender });
    }
  });

  it("kennt seit #609 auch prefer_not_to_say", () => {
    expect(GENDERS).toContain("prefer_not_to_say");
    expect(validateGender("prefer_not_to_say")).toEqual({
      ok: true,
      value: "prefer_not_to_say",
    });
  });

  it.each(["", "FEMALE", "weiblich", "divers", "male ", 1, null, undefined, {}, ["female"]])(
    "lehnt %j ab",
    (raw) => {
      const result = validateGender(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("GENDER_INVALID");
    }
  );
});
