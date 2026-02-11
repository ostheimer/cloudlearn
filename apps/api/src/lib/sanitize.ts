export function sanitizeFileName(fileName: string): string {
  const trimmed = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
  return trimmed.replace(/_+/g, "_").slice(0, 120);
}
