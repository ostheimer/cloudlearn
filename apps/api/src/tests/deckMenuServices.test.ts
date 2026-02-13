import { describe, expect, it } from "vitest";

// Integration tests — require Supabase connection
const HAS_DB =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";

describe.skipIf(!HAS_DB)("deck menu services — integration tests (Supabase)", () => {
  let testDeckId: string;

  // Setup: create a deck with cards for testing
  it("creates test deck with cards", async () => {
    const { createDeckForUser } = await import("@/services/deckService");
    const { createCardForUser } = await import("@/services/cardService");

    const deck = await createDeckForUser({
      userId,
      title: "Menu Test Deck",
      tags: ["test", "menu"],
    });
    expect(deck.title).toBe("Menu Test Deck");
    testDeckId = deck.id;

    // Add 2 cards
    const card1 = await createCardForUser({
      userId,
      deckId: testDeckId,
      card: { front: "Frage 1", back: "Antwort 1", type: "basic", difficulty: "easy", tags: [] },
    });
    expect(card1.front).toBe("Frage 1");

    const card2 = await createCardForUser({
      userId,
      deckId: testDeckId,
      card: { front: "Frage 2", back: "Antwort 2", type: "basic", difficulty: "medium", tags: [] },
    });
    expect(card2.front).toBe("Frage 2");
  });

  // Course CRUD
  it("creates and lists courses", async () => {
    const { createCourseForUser, listCoursesForUser } = await import("@/services/courseService");

    const course = await createCourseForUser({
      userId,
      title: "Test Kurs",
      description: "Beschreibung",
      color: "#6366f1",
    });
    expect(course.title).toBe("Test Kurs");

    const courses = await listCoursesForUser(userId);
    expect(courses.some((c) => c.id === course.id)).toBe(true);
  });

  it("adds and removes deck from course", async () => {
    const { createCourseForUser, addDeckToCourseForUser, removeDeckFromCourseForUser, listDecksInCourseForUser } =
      await import("@/services/courseService");

    const course = await createCourseForUser({ userId, title: "Deck-Kurs Test" });

    const added = await addDeckToCourseForUser(course.id, testDeckId);
    expect(added).toBe(true);

    const decks = await listDecksInCourseForUser(course.id);
    expect(decks.some((d) => d.id === testDeckId)).toBe(true);

    const removed = await removeDeckFromCourseForUser(course.id, testDeckId);
    expect(removed).toBe(true);
  });

  // Folder CRUD
  it("creates and lists folders", async () => {
    const { createFolderForUser, listFoldersForUser } = await import("@/services/folderService");

    const folder = await createFolderForUser({
      userId,
      title: "Test Ordner",
      color: "#f59e0b",
    });
    expect(folder.title).toBe("Test Ordner");

    const folders = await listFoldersForUser(userId);
    expect(folders.some((f) => f.id === folder.id)).toBe(true);
  });

  it("adds and removes deck from folder", async () => {
    const { createFolderForUser, addDeckToFolderForUser, removeDeckFromFolderForUser, listDecksInFolderForUser } =
      await import("@/services/folderService");

    const folder = await createFolderForUser({ userId, title: "Deck-Ordner Test" });

    const added = await addDeckToFolderForUser(folder.id, testDeckId);
    expect(added).toBe(true);

    const decks = await listDecksInFolderForUser(folder.id);
    expect(decks.some((d) => d.id === testDeckId)).toBe(true);

    const removed = await removeDeckFromFolderForUser(folder.id, testDeckId);
    expect(removed).toBe(true);
  });

  // Duplicate
  it("duplicates a deck with all cards", async () => {
    const { duplicateDeckForUser, listCardsInDeck } = await import("@/services/deckService");

    const duplicate = await duplicateDeckForUser(userId, testDeckId);
    expect(duplicate.title).toBe("Menu Test Deck (Kopie)");

    const cards = await listCardsInDeck(userId, duplicate.id);
    expect(cards.length).toBe(2);
    expect(cards.some((c) => c.front === "Frage 1")).toBe(true);
    expect(cards.some((c) => c.front === "Frage 2")).toBe(true);
  });

  // Share
  it("generates and retrieves share token", async () => {
    const { generateShareToken, getDeckByShareToken } = await import("@/services/deckService");

    const result = await generateShareToken(testDeckId);
    expect(result.shareToken).toBeTruthy();
    expect(result.deck).toBeTruthy();

    const shared = await getDeckByShareToken(result.shareToken);
    expect(shared).toBeTruthy();
    expect(shared!.id).toBe(testDeckId);
  });

  // Details
  it("gets deck details with card count and associations", async () => {
    const { getDeckDetails } = await import("@/services/deckService");

    const details = await getDeckDetails(testDeckId);
    expect(details).toBeTruthy();
    expect(details!.cardCount).toBe(2);
    expect(details!.title).toBe("Menu Test Deck");
    expect(Array.isArray(details!.courses)).toBe(true);
    expect(Array.isArray(details!.folders)).toBe(true);
  });

  // Export for offline
  it("exports deck for offline", async () => {
    const { exportDeckForOffline } = await import("@/services/deckService");

    const data = await exportDeckForOffline(userId, testDeckId);
    expect(data.deck.title).toBe("Menu Test Deck");
    expect(data.cards.length).toBe(2);
  });

  // Cleanup
  it("cleanup: deletes test deck", async () => {
    const { deleteDeckForUser } = await import("@/services/deckService");
    const ok = await deleteDeckForUser(testDeckId);
    expect(ok).toBe(true);
  });
});
