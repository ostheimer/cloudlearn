// Rewarded-ad outcome settler (#206 Teil B). A shown rewarded ad can end in
// several ways — the user earns the reward, closes it early, it errors, or it
// never loads. The bug was that only "earned" and "error" were handled, so
// closing an ad before the reward left the watch promise unresolved forever
// (the loading spinner hung and every later watchAd() returned null until an
// app restart). This one-shot settler guarantees exactly one outcome:
// "earned" credits the reward, every other terminal event resolves to "no
// reward", and anything after the first terminal event is ignored (so the
// natural "earned then closed" sequence still counts as earned).
//
// Kept free of react-native / SDK imports so the outcome logic is unit-tested
// in the node test environment; the native hook wires real AdMob events into it.

export type AdTerminalEvent = "earned" | "closed" | "error" | "timeout";

export function createAdRewardSettler(
  onSettle: (rewarded: boolean) => void,
): (event: AdTerminalEvent) => void {
  let settled = false;
  return (event: AdTerminalEvent) => {
    if (settled) return;
    settled = true;
    onSettle(event === "earned");
  };
}
