// Disposable loopback fixture for native learning QA. Never calls a real API.
// Start: node scripts/learning-qa-fixture.mjs [output.ndjson]
import http from "node:http";
import fs from "node:fs";
const userId = "20000000-0000-4000-8000-000000000001";
const deckId = "10000000-0000-4000-8000-000000000001";
const ids = Array.from({ length: 8 }, (_, i) => `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
const now = () => new Date().toISOString();
const user = { id: userId, aud: "authenticated", role: "authenticated", email: "qa@clearn.local", email_confirmed_at: now(), created_at: now(), app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {} };
const b64 = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: userId, exp: Math.floor(Date.now() / 1000) + 86400, role: "authenticated" })}.local`;
let cards, progress, reviews, awards, patches, saveError;
function reset(resume = false) {
  cards = ids.map((id, i) => ({ id, userId, deckId, front: `Frage ${i + 1}`, back: `Antwort ${i + 1}`, type: "basic", difficulty: i % 2 ? "easy" : "hard", tags: [], starred: false, fsrsDue: resume && i < 2 ? "2099-01-01T00:00:00Z" : "2020-01-01T00:00:00Z", fsrsState: "review" }));
  progress = {};
  if (resume) for (const mode of ["flashcards", "cloze"]) progress[mode] = { index: 2, cardId: ids[2], source: "due", reverse: false, total: 7, cardIds: ids.slice(0, 7), results: { [ids[0]]: { correct: true, overridden: false }, [ids[1]]: { correct: false, overridden: false } }, updatedAt: now() };
  reviews = []; awards = []; patches = []; saveError = null;
}
reset();
if (process.argv[3]) {
  ({ cards, progress, reviews, awards, patches } = JSON.parse(fs.readFileSync(process.argv[3], "utf8")));
}
const usage = { tier: "pro", lpBalance: 500, lpEarnedToday: 0, lpAdsToday: 0, lpEarnCapToday: 100, lpAdCapToday: 100, lpCostAiScan: 5, lpCostUrlImport: 5, lpCostPdfImport: 5, periodStart: null, limits: { maxDecks: 100, maxCardsPerDeck: 500 } };
http.createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let body = {};
  try { body = JSON.parse(raw); } catch { /* GET has no JSON body. */ }
  const url = new URL(req.url, "http://127.0.0.1:17869");
  const path = url.pathname, method = req.method;
  let out, status = 200;
  const deck = { id: deckId, userId, title: "Lokale Lernprüfung", tags: [], cardCount: cards.length, createdAt: now(), updatedAt: now() };
  if (path === "/qa/reset") { reset(body.resume); out = { reset: true }; }
  else if (path === "/qa/state") out = { cards, progress, reviews, awards, patches };
  else if (path === "/qa/save-error") { saveError = body.code || "DECK_FULL"; out = { armed: saveError }; }
  else if (path === "/qa/delete-card") { cards = cards.filter(card => card.id !== body.id); out = { deleted: true }; }
  else if (path === "/auth/v1/settings") out = { external: { email: true, google: false, apple: false } };
  else if (path === "/auth/v1/token") out = { access_token: token, token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: "local-refresh-token", user };
  else if (path === "/auth/v1/user") out = user;
  else if (path === "/api/v1/account/profile") out = { displayName: "Lernende", gender: "prefer_not_to_say" };
  else if (path === "/api/v1/usage") out = usage;
  else if (path === "/api/v1/subscription/status") out = { status: { userId, tier: "pro", isActive: true, expiresAt: null } };
  else if (path === "/api/v1/decks") out = { decks: [deck] };
  else if (path === `/api/v1/decks/${deckId}/details`) out = { details: deck };
  else if (path === `/api/v1/decks/${deckId}/cards`) out = { cards: [...cards].reverse() };
  else if (path === `/api/v1/decks/${deckId}/stats`) out = { deck: { id: deckId, title: deck.title }, answersTotal: reviews.length, answersCorrect: reviews.length, accuracyByDay: [], wobblyCards: [] };
  else if (path === `/api/v1/decks/${deckId}/tests`) out = method === "POST" ? { id: "local-test", questionCount: body.answers.length, correctCount: body.answers.filter(answer => answer.correct).length } : { attempts: [] };
  else if (path.startsWith("/api/v1/cards/") && method === "PATCH") {
    const id = path.split("/")[4];
    if (saveError) {
      status = saveError === "DECK_FULL" ? 409 : 503;
      out = { code: saveError, message: saveError === "DECK_FULL" ? "In diesem Tarif sind höchstens 100 Karten erlaubt." : "Local fixture unavailable" };
      saveError = null;
    } else {
      cards = cards.map(card => card.id === id ? { ...card, ...body } : card);
      out = { card: cards.find(card => card.id === id) };
    }
    patches.push({ id, ...body, status });
  } else if (path === "/api/v1/learn/sync") {
    for (const operation of body.operations) {
      if (!reviews.some(review => review.idempotencyKey === operation.payload.idempotencyKey)) reviews.push(operation.payload);
      cards = cards.map(card => card.id === operation.payload.cardId ? { ...card, fsrsDue: "2099-01-01T00:00:00Z" } : card);
    }
    out = { requestId: "local-sync", acceptedOperationIds: body.operations.map(operation => operation.operationId), rejectedOperationIds: [], serverTimestamp: now() };
  } else if (path.endsWith("/review")) {
    reviews.push(body);
    cards = cards.map(card => card.id === body.cardId ? { ...card, fsrsDue: "2099-01-01T00:00:00Z" } : card);
    out = { requestId: "local-review", cardId: body.cardId, nextDueAt: "2099-01-01T00:00:00Z", stability: 2, difficulty: 1, state: "review" };
  } else if (path === "/api/v1/learn/due") out = { cards: cards.filter(card => card.fsrsDue.startsWith("2020")) };
  else if (path === "/api/v1/learn/progress") {
    const mode = body.mode ?? url.searchParams.get("mode");
    if (method === "PUT") { progress[mode] = { ...body, updatedAt: now() }; out = { saved: true }; }
    else if (method === "DELETE") { delete progress[mode]; out = { cleared: true }; }
    else out = { progress: progress[mode] ?? null };
  } else if (path === "/api/v1/lp/earn") { awards.push(body); out = { granted: 1, newBalance: 501, capReached: false }; }
  else if (path === "/api/v1/stats/due-by-deck") out = { dueByDeck: { [deckId]: cards.filter(card => card.fsrsDue.startsWith("2020")).length } };
  else if (path === "/api/v1/stats/last-learned") out = { lastLearnedByDeck: {} };
  else if (path === "/api/v1/stats/tests") out = { attempts: [] };
  else if (path.startsWith("/api/v1/stats")) out = { stats: { totalDecks: 1, dueCards: cards.length, currentStreak: 1, longestStreak: 1, dailyGoal: 10, reviewsToday: reviews.length, reviewsTotal: reviews.length, reviewsThisWeek: reviews.length, accuracyRate: 1, reviewsByDay: [], lastReviewDate: now() }, decks: [] };
  else if (path === "/api/v1/folders") out = { folders: [] };
  else if (path.includes("milestones")) out = { milestones: [] };
  else if (path.startsWith("/api/v1/friends")) out = { friends: [], pending: [], requests: [], streaks: [] };
  else { status = 404; out = { message: "Local fixture route missing", path }; }
  if (process.argv[2]) fs.appendFileSync(process.argv[2], `${JSON.stringify({ at: now(), method, path, status, body: path.startsWith("/auth/") ? undefined : body })}\n`);
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(out));
}).listen(17869, "127.0.0.1", () => console.log("Learning QA fixture on 127.0.0.1:17869"));
