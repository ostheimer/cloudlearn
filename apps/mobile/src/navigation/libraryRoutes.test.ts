import { describe, expect, it } from "vitest";
import { buildLibraryFolderRoute } from "./libraryRoutes";

describe("libraryRoutes", () => {
  it("builds the in-tab folder detail route", () => {
    const route = buildLibraryFolderRoute("fold01", "Deutsch / B2");
    expect(route).toBe("/library-folder/fold01?title=Deutsch%20%2F%20B2");
  });
});
