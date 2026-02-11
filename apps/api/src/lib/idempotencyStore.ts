const idempotencyStore = new Map<string, unknown>();

export function getIdempotentResult<T>(key: string): T | null {
  return (idempotencyStore.get(key) as T | undefined) ?? null;
}

export function storeIdempotentResult(key: string, value: unknown): void {
  idempotencyStore.set(key, value);
}

export function resetIdempotencyStore(): void {
  idempotencyStore.clear();
}
