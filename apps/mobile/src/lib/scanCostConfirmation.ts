import type { Alert } from "react-native";

/** An explicit decision before each paid image/PDF request. Costs come from /usage. */
export async function confirmScanCost(
  cost: number,
  balance: number,
  t: (key: string, options?: { cost: number; balance: number }) => string,
  showAlert: typeof Alert.alert,
  platformOS: string,
): Promise<boolean> {
  const title = t("scan.costTitle");
  const body = t("scan.costBody", { cost, balance });
  if (platformOS === "web") {
    return typeof window !== "undefined" && typeof window.confirm === "function"
      && window.confirm(`${title}\n\n${body}`) === true;
  }
  return new Promise<boolean>((resolve) => {
    showAlert(title, body, [
      { text: t("scan.costCancel"), style: "cancel", onPress: () => resolve(false) },
      { text: t("scan.costConfirm"), onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
