interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string, limitPerMinute: number, now = Date.now()): boolean {
  const current = store.get(key);
  if (!current || current.expiresAt <= now) {
    store.set(key, { count: 1, expiresAt: now + 60_000 });
    return true;
  }

  if (current.count >= limitPerMinute) {
    return false;
  }

  store.set(key, { count: current.count + 1, expiresAt: current.expiresAt });
  return true;
}

export function resetRateLimitStore(): void {
  store.clear();
}
