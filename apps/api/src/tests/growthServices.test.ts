import { beforeEach, describe, expect, it } from "vitest";
import {
  completePdfJob,
  enqueuePdfImport,
  failPdfJob,
  markPdfJobProcessing,
  resetPdfJobs,
} from "@/services/pdfImportService";

// The community-deck and B2B-class services used to be covered here too. Both
// were removed with their routes in #425: they kept their records in a module
// array, so every serverless cold start began with an empty list and a
// "201 Created" was a promise the API could not keep.

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";

describe("growth services — unit tests (in-memory, no DB)", () => {
  beforeEach(() => {
    resetPdfJobs();
  });

  it("handles PDF import queue and retries", () => {
    const job = enqueuePdfImport(userId, "skript.pdf", 12);
    expect(markPdfJobProcessing(job.jobId)?.status).toBe("processing");
    expect(failPdfJob(job.jobId)?.status).toBe("queued");
    expect(completePdfJob(job.jobId)?.status).toBe("completed");
  });
});

// Integration tests for DB-dependent services
const HAS_DB =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!HAS_DB)("growth services — integration (Supabase)", () => {
});
