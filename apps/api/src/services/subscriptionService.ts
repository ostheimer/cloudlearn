import { z } from "zod";
import {
  subscriptionStatusSchema,
  type SubscriptionStatus,
  type SubscriptionTier,
} from "@/lib/contracts";
import { getSubscriptionTier, updateSubscriptionTier } from "@/lib/db";

export async function getSubscriptionStatus(
  userId: string
): Promise<SubscriptionStatus> {
  const { tier, expiresAt, isActive, billingIssueAt } = await getSubscriptionTier(userId);
  const paidTier = tier !== "free";
  const effectiveIsActive = paidTier && isActive;
  const effectiveTier = effectiveIsActive ? tier : "free";

  return {
    userId,
    tier: effectiveTier,
    isActive: effectiveIsActive,
    expiresAt: effectiveIsActive ? expiresAt : null,
    // Nur für wirklich aktive Bezahl-Abos: ein abgelaufenes Konto ist free,
    // da wäre ein „Zahlungsproblem"-Banner irreführend (#607).
    billingIssueAt: effectiveIsActive ? billingIssueAt : null,
  };
}

export async function updateSubscriptionStatus(
  input: SubscriptionStatus
): Promise<SubscriptionStatus> {
  const parsed = subscriptionStatusSchema.parse(input);
  const normalized: SubscriptionStatus =
    parsed.tier === "free" || !parsed.isActive
      ? {
          ...parsed,
          tier: "free",
          isActive: false,
          expiresAt: null,
          billingIssueAt: null,
        }
      : parsed;

  await updateSubscriptionTier(
    normalized.userId,
    normalized.tier,
    normalized.isActive,
    normalized.expiresAt,
    normalized.billingIssueAt ?? null
  );
  return normalized;
}

const uuidSchema = z.string().uuid();

/**
 * RevenueCat-TRANSFER (#607): Käufe sind von Konto A zu Konto B gewandert
 * (Gerätewechsel, Family Sharing). Das Ereignis nennt KEINE Entitlements —
 * deshalb lesen wir den Tarif des Quellkontos aus unserer eigenen DB, tragen
 * ihn beim Zielkonto ein und setzen das Quellkonto auf free.
 *
 * Wiederholungssicher: Beim zweiten Zustellen ist das Quellkonto schon free,
 * es wird nichts gefunden und das Zielkonto nicht mehr angefasst. LP-Guthaben
 * wandert bewusst NICHT mit — Lernpunkte sind Lernfortschritt des Kontos,
 * kein Teil des Abos.
 *
 * RevenueCat listet auch anonyme IDs ($RCAnonymousID:…); unsere app_user_ids
 * sind Supabase-UUIDs, alles andere wird übersprungen.
 */
export async function transferSubscriptionBetweenUsers(
  fromIds: string[],
  toIds: string[]
): Promise<{ movedTier: SubscriptionTier | null }> {
  const from = fromIds.filter((id) => uuidSchema.safeParse(id).success);
  const to = toIds.filter((id) => uuidSchema.safeParse(id).success);

  let moved: { tier: Exclude<SubscriptionTier, "free">; expiresAt: string | null } | null = null;
  for (const id of from) {
    const status = await getSubscriptionStatus(id);
    if (status.tier === "free") continue;
    // Bei mehreren Quellkonten gewinnt der bessere Tarif (lifetime > pro).
    if (!moved || (moved.tier === "pro" && status.tier === "lifetime")) {
      moved = { tier: status.tier, expiresAt: status.expiresAt };
    }
  }

  for (const id of from) {
    await updateSubscriptionStatus({ userId: id, tier: "free", isActive: false, expiresAt: null });
  }
  if (moved) {
    for (const id of to) {
      await updateSubscriptionStatus({
        userId: id,
        tier: moved.tier,
        isActive: true,
        expiresAt: moved.expiresAt,
      });
    }
  }
  return { movedTier: moved?.tier ?? null };
}
