import { beforeEach, describe, expect, it } from "vitest";
import { useCaptureState } from "./captureState";

describe("capture state", () => {
  beforeEach(() => {
    useCaptureState.getState().setImageUri(null);
  });

  it("stores selected image URI from camera or gallery", () => {
    useCaptureState.getState().setImageUri("file://camera.jpg");
    expect(useCaptureState.getState().imageUri).toBe("file://camera.jpg");

    useCaptureState.getState().setImageUri("file://gallery.jpg");
    expect(useCaptureState.getState().imageUri).toBe("file://gallery.jpg");
  });
});
