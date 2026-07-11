import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const lpModePages = [
  { name: "quiz", path: "app/dashboard/deck/[id]/quiz/page.tsx" },
  { name: "cloze", path: "app/dashboard/deck/[id]/cloze/page.tsx" },
];

describe("web session LP mode pages", () => {
  it.each(lpModePages)(
    "waits for persisted reviews before awarding LP in $name mode",
    ({ path }) => {
      const source = readFileSync(join(webRoot, path), "utf-8");

      expect(source).toContain("beginSessionAward");
      expect(source).toContain("getSessionReviewedCount");
      expect(source).toContain("isSessionEarnFinalized");
      expect(source).toContain("pendingReviewsRef.current.push(reviewPromise)");
      expect(source).toContain("await Promise.allSettled(pendingReviews)");
      expect(source).toContain("void awardSession(reviewedCount)");
      expect(source).toContain("await awardSession(reviewedCount)");
      expect(source).not.toContain("awardedRef");
    },
  );
});
