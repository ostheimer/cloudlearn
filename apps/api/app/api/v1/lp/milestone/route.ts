import { type NextRequest } from "next/server";
import { jsonError, jsonOk, normalizeError } from "@/lib/http";
import { createRequestContext } from "@/lib/observability";
import { getAuthUser } from "@/lib/auth";
import { milestoneKeySchema } from "@/lib/contracts";
import { z } from "zod";

const bodySchema = z.object({
  milestone: milestoneKeySchema,
});

// POST /api/v1/lp/milestone — legacy no-op (#696).
//
// Löste bis #696 `claimMilestoneReward` wirklich aus. Die RPC dahinter prüfte
// dabei nur Einmaligkeit (on-conflict-do-nothing) — NIE, ob der Meilenstein
// beim aufrufenden Konto tatsächlich erreicht war (Streak-Stand, echte
// Reviews, Deck-Existenz). Ein eingeloggtes Konto konnte sich so mit fünf
// Aufrufen alle Boni gutschreiben (440 LP: streak_100+streak_30+streak_7+
// first_deck+first_review), ohne eine einzige Karte gelernt zu haben — und am
// Tagesdeckel vorbei, weil die RPC `lp_balance` direkt erhöht und
// `lp_earned_today` unberührt lässt. Nebenschaden: Wer `streak_100` vorab
// mintete, verlor den echten Bonus an Tag 100 für immer (Einmaligkeit war
// schon verbraucht).
//
// Seit #637 lohnt sich der Aufruf ohnehin nicht: der Server löst dieselben
// Meilensteine selbst ein, sobald sie ECHT entstehen (awardMilestone /
// awardSessionMilestones / awardFirstDeckMilestone — alle mit eigener
// Anspruchsprüfung). Aktuelle Clients rufen diese Route nicht mehr auf
// (`claimMilestone` ist im Mobile-Client entfallen); sie bleibt nur für alte,
// ausgelieferte App-Builds bestehen und beantwortet deren Aufruf jetzt ohne
// jede echte Gutschrift — der Vertrag (Form der Antwort) bleibt gleich.
export async function POST(request: NextRequest) {
  const { requestId } = createRequestContext(request.headers);
  try {
    const auth = await getAuthUser(request);
    if (!auth) return jsonError(requestId, "UNAUTHORIZED", "Authentication required", 401);

    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(requestId, "VALIDATION_ERROR", parsed.error.message, 400);
    }

    // Keine echte Gutschrift mehr: der automatische Weg (#637) hat den
    // Meilenstein längst selbst eingelöst, sobald er entstand. `parsed.data`
    // wird bewusst nicht mehr benutzt außer zur Validierung — welcher
    // Meilenstein gemeint war, ändert an der Antwort nichts mehr.
    return jsonOk(requestId, { granted: 0, alreadyClaimed: true });
  } catch (error) {
    const normalized = normalizeError(error);
    return jsonError(requestId, normalized.code, normalized.message, normalized.status);
  }
}
