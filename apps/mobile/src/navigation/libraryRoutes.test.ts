import { describe, expect, it } from "vitest";
import { buildLibraryCourseRoute, buildLibraryFolderRoute } from "./libraryRoutes";

describe("libraryRoutes", () => {
  it("builds the in-tab course detail route", () => {
    const route = buildLibraryCourseRoute("abc123", "Jägersprache 101");
    expect(route).toBe("/library-course/abc123?title=J%C3%A4gersprache%20101");
  });

  it("builds the in-tab folder detail route", () => {
    const route = buildLibraryFolderRoute("fold01", "Deutsch / B2");
    expect(route).toBe("/library-folder/fold01?title=Deutsch%20%2F%20B2");
  });
});
