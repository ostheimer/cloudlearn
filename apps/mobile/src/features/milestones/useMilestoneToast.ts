import { useState, useCallback } from "react";
import { claimMilestone } from "../../lib/api";
import { useUsageStore } from "../../store/usageStore";

export interface MilestoneToast {
  key: string;
  lpGranted: number;
  label: string;
}

// Maps streak counts to milestone keys.
const STREAK_MILESTONES: Array<{ streak: number; key: "streak_7" | "streak_30" | "streak_100" }> = [
  { streak: 7,   key: "streak_7"   },
  { streak: 30,  key: "streak_30"  },
  { streak: 100, key: "streak_100" },
];

export interface UseMilestoneToastReturn {
  toast: MilestoneToast | null;
  dismissToast: () => void;
  // Full-screen celebration for streak milestones (7/30/100); stays until tapped.
  celebration: MilestoneToast | null;
  dismissCelebration: () => void;
  checkStreakMilestones: (currentStreak: number) => Promise<void>;
  claimOnceMilestone: (key: "first_deck" | "first_review") => Promise<void>;
}

export function useMilestoneToast(): UseMilestoneToastReturn {
  const [toast, setToast] = useState<MilestoneToast | null>(null);
  const [celebration, setCelebration] = useState<MilestoneToast | null>(null);
  const lpBalance = useUsageStore((s) => s.lpBalance);
  const setUsage = useUsageStore((s) => s.setUsage);

  const showToast = useCallback((key: string, lpGranted: number) => {
    setToast({ key, lpGranted, label: key });
    // Auto-dismiss after 4 seconds
    setTimeout(() => setToast(null), 4000);
  }, []);

  const checkStreakMilestones = useCallback(async (currentStreak: number) => {
    for (const { streak, key } of STREAK_MILESTONES) {
      if (currentStreak === streak) {
        const result = await claimMilestone(key).catch(() => null);
        if (result && !result.alreadyClaimed && result.granted > 0) {
          setUsage({ lpBalance: lpBalance + result.granted });
          // Streak milestones earn the big moment; smaller ones stay a toast.
          setCelebration({ key, lpGranted: result.granted, label: key });
        }
      }
    }
  }, [lpBalance, setUsage]);

  const claimOnceMilestone = useCallback(async (key: "first_deck" | "first_review") => {
    const result = await claimMilestone(key).catch(() => null);
    if (result && !result.alreadyClaimed && result.granted > 0) {
      setUsage({ lpBalance: lpBalance + result.granted });
      showToast(key, result.granted);
    }
  }, [lpBalance, setUsage, showToast]);

  const dismissToast = useCallback(() => setToast(null), []);
  const dismissCelebration = useCallback(() => setCelebration(null), []);

  return { toast, dismissToast, celebration, dismissCelebration, checkStreakMilestones, claimOnceMilestone };
}
