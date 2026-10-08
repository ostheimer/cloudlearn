import { describe, expect, it, vi } from "vitest";
import type { AppStateStatus } from "react-native";
import type { SessionProgress } from "./sessionProgress";
import {
  bindSessionProgressLifecycle,
  type ProgressAppState,
} from "./sessionProgressLifecycle";

const progress = (index = 1): SessionProgress => ({
  index,
  cardId: `card-${index + 1}`,
  source: "due",
  reverse: false,
  total: 10,
  results: { "card-1": { correct: true, overridden: false } },
});

function mount(initialState: AppStateStatus | null = "active") {
  const listeners = new Set<(state: AppStateStatus) => void>();
  const remove = vi.fn();
  const appState: ProgressAppState = {
    currentState: initialState,
    addEventListener: (_type, listener) => {
      listeners.add(listener);
      return {
        remove() {
          listeners.delete(listener);
          remove();
        },
      };
    },
  };
  let pending: SessionProgress | null = progress();
  const push = vi.fn(async (_snapshot: SessionProgress) => {});
  const unmount = bindSessionProgressLifecycle({
    appState,
    getProgress: () => pending,
    pushProgress: push,
  });
  return {
    push,
    remove,
    unmount,
    update(snapshot: SessionProgress | null) {
      pending = snapshot;
    },
    change(state: AppStateStatus) {
      appState.currentState = state;
      for (const listener of listeners) listener(state);
    },
  };
}

describe("session progress at mobile lifecycle boundaries (#697)", () => {
  it.each([null, progress(3)])("waits for durable reviews and discards a completed or superseded bookmark: %j", async (replacement) => {
    let change!: (state: AppStateStatus) => void;
    let finishPersistence!: () => void;
    const persisted = new Promise<void>((resolve) => { finishPersistence = resolve; });
    const push = vi.fn(async () => {});
    let pending: SessionProgress | null = progress();
    bindSessionProgressLifecycle({
      appState: { currentState: "active", addEventListener: (_event, listener) => {
        change = listener;
        return { remove() {} };
      } },
      getProgress: () => pending,
      beforePush: () => persisted,
      pushProgress: push,
    });
    change("background");
    expect(push).not.toHaveBeenCalled();
    pending = replacement;
    finishPersistence();
    await persisted;
    await Promise.resolve();
    expect(push).not.toHaveBeenCalled();
  });

  it("publishes the unchanged bookmark only after the review checkpoint is durable", async () => {
    let change!: (state: AppStateStatus) => void;
    let finish!: () => void;
    const persisted = new Promise<void>((resolve) => { finish = resolve; });
    const push = vi.fn(async () => {});
    bindSessionProgressLifecycle({
      appState: { currentState: "active", addEventListener: (_event, listener) => {
        change = listener;
        return { remove() {} };
      } },
      getProgress: () => progress(),
      beforePush: () => persisted,
      pushProgress: push,
    });
    change("inactive");
    change("background");
    expect(push).not.toHaveBeenCalled();
    finish();
    await persisted;
    await Promise.resolve();
    expect(push).toHaveBeenCalledExactlyOnceWith(progress());
  });
  it("sends the latest position and results when the mounted app goes to background", () => {
    const screen = mount();
    const latest = progress(4);
    screen.update(latest);
    screen.change("background");

    expect(screen.push).toHaveBeenCalledExactlyOnceWith(latest);
  });

  it("writes on iOS inactive and does not duplicate it on the following background event", () => {
    const screen = mount();
    screen.change("inactive");
    expect(screen.push).toHaveBeenCalledExactlyOnceWith(progress());

    screen.change("background");
    screen.change("background");
    expect(screen.push).toHaveBeenCalledTimes(1);
  });

  it("sends changed progress after returning active and leaving again", () => {
    const screen = mount();
    screen.change("inactive");
    screen.change("background");
    screen.change("active");
    const latest = progress(7);
    screen.update(latest);
    screen.change("background");

    expect(screen.push.mock.calls).toEqual([[progress()], [latest]]);
  });

  it("does not send a request for each card or an active event", () => {
    const screen = mount();
    screen.update(progress(2));
    screen.update(progress(3));
    screen.change("active");
    screen.update(progress(4));

    expect(screen.push).not.toHaveBeenCalled();
  });

  it("keeps the latest-progress fallback when the learner leaves the screen", () => {
    const screen = mount();
    const latest = progress(5);
    screen.update(latest);
    screen.unmount();

    expect(screen.push).toHaveBeenCalledExactlyOnceWith(latest);
  });

  it("does not resurrect a completed round on a later background or unmount", () => {
    const screen = mount();
    screen.change("background");
    screen.change("active");
    screen.update(null);
    screen.change("inactive");
    screen.change("background");
    screen.unmount();

    expect(screen.push).toHaveBeenCalledExactlyOnceWith(progress());
  });

  it("does not save an empty session at either lifecycle boundary", () => {
    const screen = mount();
    screen.update(null);
    screen.change("background");
    screen.unmount();

    expect(screen.push).not.toHaveBeenCalled();
  });

  it("removes the AppState listener on unmount", () => {
    const screen = mount();
    screen.unmount();
    screen.push.mockClear();
    screen.change("active");
    screen.change("background");

    expect(screen.remove).toHaveBeenCalledTimes(1);
    expect(screen.push).not.toHaveBeenCalled();
  });

  it("handles a first departure before React Native has reported the initial state", () => {
    const screen = mount(null);
    screen.change("background");

    expect(screen.push).toHaveBeenCalledExactlyOnceWith(progress());
  });
});
