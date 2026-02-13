import { test, expect } from "@playwright/test";
import { apiRequest } from "./helpers";

test.describe("Deck Menu API Flow", () => {
  let deckId: string;
  let courseId: string;
  let folderId: string;

  // Setup: create a deck with cards
  test("setup: create deck with cards", async () => {
    const { status, body } = await apiRequest<{ deck: { id: string; title: string } }>(
      "/api/v1/decks",
      {
        method: "POST",
        body: JSON.stringify({ title: "Menu E2E Deck", tags: ["e2e", "menu"] }),
      }
    );
    expect(status).toBe(201);
    deckId = body.deck.id;

    // Add a card
    const cardRes = await apiRequest<{ card: { id: string } }>("/api/v1/cards", {
      method: "POST",
      body: JSON.stringify({
        deckId,
        card: { front: "E2E Frage", back: "E2E Antwort", type: "basic", difficulty: "easy", tags: [] },
      }),
    });
    expect(cardRes.status).toBe(201);
  });

  // Course CRUD
  test("create a course", async () => {
    const { status, body } = await apiRequest<{ course: { id: string; title: string } }>(
      "/api/v1/courses",
      {
        method: "POST",
        body: JSON.stringify({ title: "E2E Kurs", description: "Test-Kurs" }),
      }
    );
    expect(status).toBe(201);
    expect(body.course.title).toBe("E2E Kurs");
    courseId = body.course.id;
  });

  test("list courses", async () => {
    const { status, body } = await apiRequest<{ courses: Array<{ id: string }> }>("/api/v1/courses");
    expect(status).toBe(200);
    expect(body.courses.some((c) => c.id === courseId)).toBe(true);
  });

  test("add deck to course", async () => {
    const { status, body } = await apiRequest<{ added: boolean }>(
      `/api/v1/courses/${courseId}/decks`,
      {
        method: "POST",
        body: JSON.stringify({ deckId }),
      }
    );
    expect(status).toBe(201);
    expect(body.added).toBe(true);
  });

  test("list decks in course", async () => {
    const { status, body } = await apiRequest<{ decks: Array<{ id: string }> }>(
      `/api/v1/courses/${courseId}/decks`
    );
    expect(status).toBe(200);
    expect(body.decks.some((d) => d.id === deckId)).toBe(true);
  });

  test("remove deck from course", async () => {
    const { status, body } = await apiRequest<{ removed: boolean }>(
      `/api/v1/courses/${courseId}/decks?deckId=${deckId}`,
      { method: "DELETE" }
    );
    expect(status).toBe(200);
    expect(body.removed).toBe(true);
  });

  // Folder CRUD
  test("create a folder", async () => {
    const { status, body } = await apiRequest<{ folder: { id: string; title: string } }>(
      "/api/v1/folders",
      {
        method: "POST",
        body: JSON.stringify({ title: "E2E Ordner" }),
      }
    );
    expect(status).toBe(201);
    expect(body.folder.title).toBe("E2E Ordner");
    folderId = body.folder.id;
  });

  test("add deck to folder", async () => {
    const { status, body } = await apiRequest<{ added: boolean }>(
      `/api/v1/folders/${folderId}/decks`,
      {
        method: "POST",
        body: JSON.stringify({ deckId }),
      }
    );
    expect(status).toBe(201);
    expect(body.added).toBe(true);
  });

  test("list decks in folder", async () => {
    const { status, body } = await apiRequest<{ decks: Array<{ id: string }> }>(
      `/api/v1/folders/${folderId}/decks`
    );
    expect(status).toBe(200);
    expect(body.decks.some((d) => d.id === deckId)).toBe(true);
  });

  // Duplicate
  test("duplicate deck", async () => {
    const { status, body } = await apiRequest<{ deck: { id: string; title: string } }>(
      `/api/v1/decks/${deckId}/duplicate`,
      { method: "POST" }
    );
    expect(status).toBe(201);
    expect(body.deck.title).toBe("Menu E2E Deck (Kopie)");

    // Cleanup duplicate
    await apiRequest(`/api/v1/decks/${body.deck.id}`, { method: "DELETE" });
  });

  // Share
  test("share deck and retrieve by token", async () => {
    const shareRes = await apiRequest<{ shareToken: string; shareUrl: string }>(
      `/api/v1/decks/${deckId}/share`,
      { method: "POST" }
    );
    expect(shareRes.status).toBe(201);
    expect(shareRes.body.shareToken).toBeTruthy();
    expect(shareRes.body.shareUrl).toContain(shareRes.body.shareToken);

    // Retrieve shared deck (unauthenticated would also work via public policy)
    const getRes = await apiRequest<{ deck: { id: string; title: string }; cards: Array<{ id: string }> }>(
      `/api/v1/decks/share/${shareRes.body.shareToken}`
    );
    expect(getRes.status).toBe(200);
    expect(getRes.body.deck.id).toBe(deckId);
    expect(getRes.body.cards.length).toBeGreaterThanOrEqual(1);
  });

  // Export
  test("export deck for offline", async () => {
    const { status, body } = await apiRequest<{
      deck: { id: string; title: string };
      cards: Array<{ id: string }>;
      exportedAt: string;
    }>(`/api/v1/decks/${deckId}/export`);
    expect(status).toBe(200);
    expect(body.deck.id).toBe(deckId);
    expect(body.cards.length).toBeGreaterThanOrEqual(1);
    expect(body.exportedAt).toBeTruthy();
  });

  // Details
  test("get deck details", async () => {
    const { status, body } = await apiRequest<{
      details: {
        id: string;
        title: string;
        cardCount: number;
        courses: Array<{ id: string }>;
        folders: Array<{ id: string }>;
      };
    }>(`/api/v1/decks/${deckId}/details`);
    expect(status).toBe(200);
    expect(body.details.id).toBe(deckId);
    expect(body.details.cardCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.details.courses)).toBe(true);
    expect(Array.isArray(body.details.folders)).toBe(true);
  });

  // Cleanup
  test("cleanup: delete course, folder, deck", async () => {
    const courseRes = await apiRequest(`/api/v1/courses/${courseId}`, { method: "DELETE" });
    expect(courseRes.status).toBe(200);

    const folderRes = await apiRequest(`/api/v1/folders/${folderId}`, { method: "DELETE" });
    expect(folderRes.status).toBe(200);

    const deckRes = await apiRequest(`/api/v1/decks/${deckId}`, { method: "DELETE" });
    expect(deckRes.status).toBe(200);
  });
});
