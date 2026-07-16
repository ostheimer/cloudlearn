export interface ImportAttemptKey {
  signature: string;
  key: string;
}

type ImportKeyFactory = (prefix: string) => string;

function createImportKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getStableImportAttemptKey(
  current: ImportAttemptKey | null,
  signature: string,
  prefix: string,
  keyFactory: ImportKeyFactory = createImportKey
): ImportAttemptKey {
  if (current?.signature === signature) {
    return current;
  }

  return {
    signature,
    key: keyFactory(prefix),
  };
}
