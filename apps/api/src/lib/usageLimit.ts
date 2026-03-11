// Re-exports DB-backed quota functions for backwards compatibility.
// The old in-memory implementation is replaced by Supabase-backed
// consumeAiScanQuota / consumeUrlImportQuota in db.ts.
export {
  consumeAiScanQuota,
  consumeUrlImportQuota,
  getAiUsage,
} from "./db";

// Kept for test compatibility — no-op in production (DB is source of truth).
export function resetUsageLimitStore(): void {
  // In-memory store is gone; tests that need a clean state should reset the DB row directly.
}
