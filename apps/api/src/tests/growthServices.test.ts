import { beforeEach, describe, expect, it } from "vitest";
import { createDeckForUser } from "@/services/deckService";
import { processScan } from "@/services/scanService";
import { exportDeckAsApkg } from "@/services/ankiExportService";
import { createB2bClass, listB2bClasses, resetB2bStore } from "@/services/b2bService";
import {
  completePdfJob,
  enqueuePdfImport,
  failPdfJob,
  markPdfJobProcessing,
  resetPdfJobs
} from "@/services/pdfImportService";
import {
  canProcessMathpix,
  consumeMathpixCost,
  getMathpixSpend,
  resetMathpixCosts
} from "@/services/mathpixService";
import {
  listCommunityDecks,
  publishCommunityDeck,
  resetCommunityDeckStore
} from "@/services/communityDeckService";
import { resetStore } from "@/lib/inMemoryStore";
import { resetIdempotencyStore } from "@/lib/idempotencyStore";

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";

describe("growth services", () => {
  beforeEach(() => {
    resetStore();
    resetIdempotencyStore();
    resetPdfJobs();
    resetMathpixCosts();
    resetCommunityDeckStore();
    resetB2bStore();
  });

  it("handles PDF import queue and retries", () => {
    const job = enqueuePdfImport(userId, "skript.pdf", 12);
    expect(markPdfJobProcessing(job.jobId)?.status).toBe("processing");
    expect(failPdfJob(job.jobId)?.status).toBe("queued");
    expect(completePdfJob(job.jobId)?.status).toBe("completed");
  });

  it("tracks Mathpix spend and budget", () => {
    for (let i = 0; i < 3; i += 1) {
      consumeMathpixCost(userId);
    }
    expect(getMathpixSpend(userId)).toBeCloseTo(0.006, 5);
    expect(canProcessMathpix(userId, 0.001)).toBe(false);
  });

  it("exports decks in apkg format", () => {
    const deck = createDeckForUser({ userId, title: "Export", tags: [] });
    processScan(
      {
        userId,
        extractedText: "Merksatz eins. Merksatz zwei.",
        sourceLanguage: "de",
        idempotencyKey: "scan-key-export-001",
        deckId: deck.id
      },
      "req-export"
    );
    const exportFile = exportDeckAsApkg(userId, deck.id);
    expect(exportFile.fileName.endsWith(".apkg")).toBe(true);
    expect(exportFile.content).toContain("apkg-mock");
  });

  it("flags abusive community decks", () => {
    publishCommunityDeck({
      userId,
      deckId: "2d0afe28-6be8-46fb-a85a-df88d3db9f5f",
      title: "Normales Deck",
      description: "hilfreich"
    });
    publishCommunityDeck({
      userId,
      deckId: "6f0ff1ad-8f34-4b06-9ef2-6d4f6cda95f1",
      title: "Scam Angebot",
      description: "spam content"
    });

    expect(listCommunityDecks("approved")).toHaveLength(1);
    expect(listCommunityDecks("flagged")).toHaveLength(1);
  });

  it("isolates B2B classes by tenant", () => {
    createB2bClass({
      tenantId: "school-a",
      teacherUserId: userId,
      className: "10A"
    });
    createB2bClass({
      tenantId: "school-b",
      teacherUserId: "0b25d170-8d32-47f0-9e4a-5631161fb2b4",
      className: "11B"
    });

    expect(listB2bClasses("school-a")).toHaveLength(1);
    expect(listB2bClasses("school-b")).toHaveLength(1);
  });
});
