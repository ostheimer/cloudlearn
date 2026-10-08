/** Route a source tap before opening a camera, picker, or input mode. */
export function runScanSourceAction({
  balance,
  cost,
  busy,
  onContinue,
  onInsufficient,
}: {
  balance: number;
  cost: number;
  busy: boolean;
  onContinue: () => void;
  onInsufficient: (cost: number) => void;
}): void {
  if (busy) return;
  if (balance < cost) {
    onInsufficient(cost);
    return;
  }
  onContinue();
}
