type Tier = "free" | "pro" | "lifetime";

interface UsageCounter {
  count: number;
  periodStartMonth: string;
}

const scanUsageStore = new Map<string, UsageCounter>();

function currentMonth(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function consumeScanQuota(
  userId: string,
  tier: Tier,
  freeLimitPerMonth: number,
  now = new Date()
): { allowed: boolean; remaining: number } {
  if (tier !== "free") {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY };
  }

  const month = currentMonth(now);
  const current = scanUsageStore.get(userId);
  if (!current || current.periodStartMonth !== month) {
    scanUsageStore.set(userId, { count: 1, periodStartMonth: month });
    return { allowed: true, remaining: Math.max(freeLimitPerMonth - 1, 0) };
  }

  if (current.count >= freeLimitPerMonth) {
    return { allowed: false, remaining: 0 };
  }

  const nextCount = current.count + 1;
  scanUsageStore.set(userId, { ...current, count: nextCount });
  return { allowed: true, remaining: Math.max(freeLimitPerMonth - nextCount, 0) };
}

export function resetUsageLimitStore(): void {
  scanUsageStore.clear();
}
