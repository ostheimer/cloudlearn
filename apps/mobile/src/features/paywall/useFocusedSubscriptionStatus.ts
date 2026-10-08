import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getSubscriptionStatus } from "../../lib/api";

type Status = Awaited<ReturnType<typeof getSubscriptionStatus>>["status"];
type Result = {
  userId: string;
  status: Status | null;
  failed: boolean;
};

/** Tabs stay mounted beneath the paywall; reload the server's tier on return. */
export function useFocusedSubscriptionStatus(userId: string | null) {
  const [result, setResult] = useState<Result | null>(null);
  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let active = true;
    void getSubscriptionStatus().then(
      ({ status }) => {
        if (active) setResult({ userId, status, failed: false });
      },
      () => {
        if (active) setResult({ userId, status: null, failed: true });
      }
    );
    // A blurred screen or previous account must not overwrite the next read.
    return () => {
      active = false;
    };
  }, [userId]));
  return result?.userId === userId ? result : null;
}
