import type { AppStateStatus } from "react-native";
import type { SessionProgress } from "./sessionProgress";

export interface ProgressAppState {
  currentState: AppStateStatus | null;
  addEventListener(
    type: "change",
    listener: (state: AppStateStatus) => void,
  ): { remove(): void };
}

interface SessionProgressLifecycleOptions {
  appState: ProgressAppState;
  getProgress: () => SessionProgress | null;
  beforePush?: () => Promise<void>;
  pushProgress: (progress: SessionProgress) => Promise<void>;
}

/**
 * Push the current bookmark when a mounted screen leaves the foreground.
 * Local storage still runs on each answer; account writes only happen at these
 * lifecycle boundaries. The getter must return null for a completed round.
 * `pushProgress` uses the existing best-effort account sync.
 */
export function bindSessionProgressLifecycle({
  appState,
  getProgress,
  beforePush,
  pushProgress,
}: SessionProgressLifecycleOptions): () => void {
  const flush = () => {
    const pending = getProgress();
    if (!pending) return;
    if (!beforePush) {
      void pushProgress(pending);
      return;
    }
    // Persist the original review operation before publishing a position that
    // skips its card. Keep this boundary's snapshot: later foreground answers
    // have not passed through this commit yet.
    void beforePush().then(() => {
      const current = getProgress();
      if (current && JSON.stringify(current) === JSON.stringify(pending)) {
        return pushProgress(pending);
      }
    }).catch(() => {
      // Storage/account unavailable: retain the local bookmark and retry at
      // the next boundary. Never publish a bookmark ahead of durable reviews.
    });
  };

  // React Native can initially report null before the native state arrives.
  // Treat that as foreground so the first departure still saves the bookmark.
  let foreground =
    appState.currentState !== "inactive" && appState.currentState !== "background";
  const subscription = appState.addEventListener("change", (state) => {
    if (state === "active") {
      foreground = true;
      return;
    }
    if (foreground && (state === "inactive" || state === "background")) {
      // iOS emits inactive → background for one departure. Save on inactive,
      // while execution is still available, and avoid a second request.
      foreground = false;
      flush();
    }
  });

  return () => {
    subscription.remove();
    // Navigation can unmount the screen while the app remains active. Retain
    // its fallback and always read the latest ref instead of a saved snapshot.
    flush();
  };
}
