import { randomUUID } from "node:crypto";
import {
  flashcardListSchema,
  pdfImportJobSchema,
  pdfImportRequestSchema,
  type PdfImportJob,
  type PdfImportResponse,
} from "@/lib/contracts";
import { createCard, createDeck, getDeck, recordScan } from "@/lib/db";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/idempotencyStore";
import { generateFlashcardsAsync } from "@/lib/llm";
import { extractPdfText } from "@/lib/pdf";
import { sanitizeFileName } from "@/lib/sanitize";

const jobs = new Map<string, PdfImportJob>();

export function enqueuePdfImport(userId: string, fileName: string, pageCount: number): PdfImportJob {
  const job = pdfImportJobSchema.parse({
    jobId: randomUUID(),
    userId,
    fileName,
    pageCount,
    status: "queued",
    retries: 0
  });
  jobs.set(job.jobId, job);
  return job;
}

export function markPdfJobProcessing(jobId: string): PdfImportJob | null {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }
  const next: PdfImportJob = { ...job, status: "processing" };
  jobs.set(jobId, next);
  return next;
}

export function completePdfJob(jobId: string): PdfImportJob | null {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }
  const next: PdfImportJob = { ...job, status: "completed" };
  jobs.set(jobId, next);
  return next;
}

export function failPdfJob(jobId: string, maxRetries = 3): PdfImportJob | null {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }
  const retries = job.retries + 1;
  const status = retries >= maxRetries ? "failed" : "queued";
  const next: PdfImportJob = { ...job, retries, status };
  jobs.set(jobId, next);
  return next;
}

export function getPdfJob(jobId: string): PdfImportJob | null {
  return jobs.get(jobId) ?? null;
}

export function resetPdfJobs(): void {
  jobs.clear();
}

export async function processPdfImport(
  input: unknown,
  requestId: string,
  userId: string
): Promise<PdfImportResponse> {
  const parsed = pdfImportRequestSchema.parse(input);
  const existing = getIdempotentResult<PdfImportResponse>(parsed.idempotencyKey);
  if (existing) {
    return existing;
  }

  const extracted = await extractPdfText(parsed.fileBase64);
  const generated = await generateFlashcardsAsync(
    extracted.extractedText,
    parsed.sourceLanguage
  );
  const cards = flashcardListSchema.parse(generated.cards);

  let deck = parsed.deckId ? await getDeck(parsed.deckId) : null;
  if (!deck) {
    deck = await createDeck(userId, generated.title, ["pdf-import"]);
  }

  for (const card of cards) {
    await createCard(userId, deck.id, card);
  }

  await recordScan(
    userId,
    generated.model,
    cards.length,
    `pdf:${sanitizeFileName(parsed.fileName)}`,
    extracted.extractedText
  );

  const response: PdfImportResponse = {
    requestId,
    model: generated.model,
    fallbackUsed: generated.fallbackUsed,
    cards,
    deckTitle: generated.title,
    fileName: parsed.fileName.trim(),
    pageCount: extracted.pageCount,
    extractedCharacters: extracted.extractedCharacters,
  };

  storeIdempotentResult(parsed.idempotencyKey, response);
  return response;
}
