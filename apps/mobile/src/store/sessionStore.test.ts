import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase", () => ({ supabase: {} }));

import { useSessionStore } from "./sessionStore";

describe("sessionStore", () => {
  beforeEach(() => {
    useSessionStore.getState().setDueCount(0);
  });

  it("has dueCount initial 0", () => {
    useSessionStore.getState().setDueCount(0);
    expect(useSessionStore.getState().dueCount).toBe(0);
  });

  it("setDueCount(n) sets dueCount to n", () => {
    useSessionStore.getState().setDueCount(3);
    expect(useSessionStore.getState().dueCount).toBe(3);
  });

  it("subsequent setDueCount overwrites previous value", () => {
    useSessionStore.getState().setDueCount(3);
    useSessionStore.getState().setDueCount(7);
    expect(useSessionStore.getState().dueCount).toBe(7);
  });
});
