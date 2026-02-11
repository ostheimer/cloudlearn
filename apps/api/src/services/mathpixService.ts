const COST_PER_IMAGE_USD = 0.002;
const DEFAULT_BUDGET_USD = 5;

interface UserCostState {
  spentUsd: number;
}

const mathpixCostStore = new Map<string, UserCostState>();

export function canProcessMathpix(userId: string, budgetUsd = DEFAULT_BUDGET_USD): boolean {
  const spent = mathpixCostStore.get(userId)?.spentUsd ?? 0;
  return spent + COST_PER_IMAGE_USD <= budgetUsd;
}

export function consumeMathpixCost(userId: string): number {
  const current = mathpixCostStore.get(userId) ?? { spentUsd: 0 };
  const next = current.spentUsd + COST_PER_IMAGE_USD;
  mathpixCostStore.set(userId, { spentUsd: next });
  return next;
}

export function getMathpixSpend(userId: string): number {
  return mathpixCostStore.get(userId)?.spentUsd ?? 0;
}

export function resetMathpixCosts(): void {
  mathpixCostStore.clear();
}
