import { test, expect } from "@playwright/test";
import { apiRequestAnon, apiRequest } from "./helpers";

test.describe("API Health & Auth", () => {
  test("GET /api/health returns ok", async () => {
    const { status, body } = await apiRequestAnon<{ status: string; version: string }>(
      "/api/health"
    );
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.version).toBeTruthy();
  });

  test("protected endpoints return 401 without auth", async () => {
    const endpoints = [
      "/api/v1/stats",
      "/api/v1/decks",
      "/api/v1/learn/due",
    ];

    for (const endpoint of endpoints) {
      const { status, body } = await apiRequestAnon<{ code: string }>(endpoint);
      expect(status).toBe(401);
      expect(body.code).toBe("UNAUTHORIZED");
    }
  });

  test("protected endpoints return 200 with valid auth", async () => {
    const { status: statsStatus } = await apiRequest("/api/v1/stats");
    expect(statsStatus).toBe(200);

    const { status: decksStatus } = await apiRequest("/api/v1/decks");
    expect(decksStatus).toBe(200);
  });
});
