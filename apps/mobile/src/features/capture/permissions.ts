export type PermissionState = "granted" | "denied" | "permanently-denied";

export interface PermissionResult {
  camera: PermissionState;
  gallery: PermissionState;
}

export function canUseCapture(result: PermissionResult): boolean {
  return result.camera === "granted" || result.gallery === "granted";
}

export function getCaptureFallbackMessage(result: PermissionResult): string {
  if (result.camera === "permanently-denied" && result.gallery !== "granted") {
    return "Bitte Kamera-Berechtigung in den Systemeinstellungen aktivieren.";
  }

  if (result.camera === "denied" && result.gallery === "granted") {
    return "Kamera ist deaktiviert, Galerie-Import ist weiterhin verfügbar.";
  }

  if (!canUseCapture(result)) {
    return "Keine Berechtigung verfügbar.";
  }

  return "";
}
