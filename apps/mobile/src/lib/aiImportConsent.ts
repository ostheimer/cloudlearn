import type { Alert } from "react-native";

export type AiImportSource = "photo" | "pdf" | "text" | "url";

/** Each transmission needs a fresh choice; permission is never persisted. */
export function createAiImportConsentGate() {
  let pending = false;

  return async (
    source: AiImportSource,
    translate: (key: string) => string,
    showAlert: typeof Alert.alert,
  ): Promise<boolean> => {
    // A second tap while the native dialog is open must not queue another send.
    if (pending) return false;
    pending = true;
    try {
      return await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (allowed: boolean) => {
          if (settled) return;
          settled = true;
          resolve(allowed);
        };
        showAlert(
          translate("scan.aiConsentTitle"),
          translate(`scan.aiConsent.${source}`),
          [
            {
              text: translate("scan.aiConsentCancel"),
              style: "cancel",
              onPress: () => finish(false),
            },
            {
              text: translate("scan.aiConsentSend"),
              onPress: () => finish(true),
            },
          ],
          { cancelable: true, onDismiss: () => finish(false) },
        );
      });
    } finally {
      pending = false;
    }
  };
}
