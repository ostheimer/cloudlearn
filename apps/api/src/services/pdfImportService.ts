import { randomUUID } from "node:crypto";
import { pdfImportJobSchema, type PdfImportJob } from "@/lib/contracts";

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
