import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { awardSessionMilestones, earnLp, getLpProfile } from "@/services/lpService";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { lpEarnRequestSchema } from "@/lib/contracts";

// POST /api/v1/lp/earn — grant LP for a completed learning session (type:"session").
// Rewarded-ad LP is NOT granted here anymore; it requires AdMob Server-Side
// Verification via its own endpoint (#149). "dailyGoal"/"ad" are rejected by the schema.
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json().catch(() => ({}));
    const parsed = lpEarnRequestSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(requestId, "VALIDATION_ERROR", parsed.error.message, 400);
    }

    const subscription = await getSubscriptionStatus(auth.userId);
    // The grant is derived server-side from recorded reviews; parsed.data.sessionCardCount
    // is accepted for client compatibility but ignored. (parsed.data.type is always
    // "session" — the schema rejects anything else.)
    const result = await earnLp(auth.userId, subscription.tier);

    // Ende einer Lernsitzung — hier hängen „erste Lernsitzung" und die
    // Streak-Stufen (#637). Diese Route ist der gemeinsame Abschluss ALLER
    // punktenden Lernarten in beiden Clients (Karteikarten, Lückentext, Quiz,
    // Zuordnen, Bildkarten); die Prüfung gibt keine Punkte und löst die
    // Meilensteine deshalb auf ihrem eigenen Weg aus.
    //
    // Auch wenn `granted` 0 ist (Tageslimit erreicht) wurde gelernt — der
    // Meilenstein hängt an der Sitzung, nicht an der Gutschrift.
    const milestones = await awardSessionMilestones(auth.userId);
    // Eine Meilenstein-Gutschrift ist eine zweite atomare Buchung nach earnLp.
    // Den neuen Stand deshalb aus der Datenbank lesen: Addieren würde
    // gleichzeitige Käufe, Werbe-Boni oder andere Gutschriften überschreiben
    // und dem Client einen erfundenen Kontostand melden (#702).
    const newBalance =
      milestones.length > 0 ? (await getLpProfile(auth.userId)).balance : result.newBalance;

    return jsonOk(requestId, {
      granted: result.granted,
      newBalance,
      capReached: result.capReached,
      milestones,
    });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
