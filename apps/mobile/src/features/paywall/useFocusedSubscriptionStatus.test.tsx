import React, { createContext, useContext, useEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusedSubscriptionStatus } from "./useFocusedSubscriptionStatus";

const api = vi.hoisted(() => ({ getSubscriptionStatus: vi.fn() }));
vi.mock("../../lib/api", () => api);
const Focus = createContext(true);
vi.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const focused = useContext(Focus);
    useEffect(() => focused ? effect() : undefined, [focused, effect]);
  },
}));

function Screen({ userId }: { userId: string | null }) {
  const result = useFocusedSubscriptionStatus(userId);
  return React.createElement("span", null, result?.failed ? "error" : result?.status?.tier ?? "loading");
}
const status = (tier: "free" | "pro") => ({
  status: { userId: "a", tier, isActive: tier === "pro", expiresAt: null },
});
let renderer: ReactTestRenderer;
async function show(focused: boolean, userId: string | null = "a") {
  await act(async () => {
    const tree = <Focus.Provider value={focused}><Screen userId={userId} /></Focus.Provider>;
    if (renderer) {
      renderer.update(tree);
    } else {
      renderer = create(tree);
    }
  });
}
function tier() {
  return renderer.root.findByType("span").children.join("");
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  api.getSubscriptionStatus.mockReset();
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  renderer = undefined as unknown as ReactTestRenderer;
});

describe("subscription screen focus", () => {
  it("refreshes Free to Pro when the same mounted screen returns from a purchase", async () => {
    api.getSubscriptionStatus.mockResolvedValueOnce(status("free")).mockResolvedValueOnce(status("pro"));
    await show(true);
    expect(tier()).toBe("free");
    await show(false);
    await show(true);
    expect(tier()).toBe("pro");
    expect(api.getSubscriptionStatus).toHaveBeenCalledTimes(2);
  });

  it("ignores a Free response from an earlier focus after Pro was loaded", async () => {
    let finishOld!: (value: ReturnType<typeof status>) => void;
    api.getSubscriptionStatus
      .mockReturnValueOnce(new Promise(resolve => {
        finishOld = resolve;
      }))
      .mockResolvedValueOnce(status("pro"));
    await show(true);
    await show(false);
    await show(true);
    expect(tier()).toBe("pro");
    await act(async () => finishOld(status("free")));
    expect(tier()).toBe("pro");
  });

  it("does not show a previous account's subscription while switching accounts", async () => {
    api.getSubscriptionStatus.mockResolvedValueOnce(status("pro")).mockReturnValueOnce(new Promise(() => {}));
    await show(true);
    expect(tier()).toBe("pro");
    await show(true, "b");
    expect(tier()).toBe("loading");
    await show(true, null);
    expect(tier()).toBe("loading");
    expect(api.getSubscriptionStatus).toHaveBeenCalledTimes(2);
  });

  it("recovers from a failed read on next focus without inventing paid access", async () => {
    api.getSubscriptionStatus.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(status("free"));
    await show(true);
    expect(tier()).toBe("error");
    await show(false);
    await show(true);
    expect(tier()).toBe("free");
  });
});
