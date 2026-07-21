import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

// #364: Occlusion ist serverseitig eine Pro-Funktion (402/PAYWALL_REQUIRED).
// Das Web hat keinen Kaufweg (#368) — ohne eigenen 402-Zweig landete die rohe
// englische Server-Meldung „This feature requires Pro. Upgrade to unlock it."
// im roten Banner und die Nutzerin stand vor einer Sackgasse.
describe("web occlusion editor – paywall message", () => {
  const source = readFileSync(
    join(webRoot, "app/dashboard/deck/[id]/occlusion/new/page.tsx"),
    "utf-8",
  ).replace(/\r\n/g, "\n");

  it("beantwortet das Pro-Gate mit der deutschen Meldung statt mit dem Server-Text", () => {
    // Bedingung seit #371 auf den CODE geschärft, nicht mehr auf den Status:
    // 402 trugen früher auch „Deck voll" und „zu viele Decks". Wer hier auf den
    // Status prüfte, behauptete bei einem vollen Deck, Bild-Occlusion sei eine
    // Pro-Funktion — obwohl sie freigeschaltet war und nur der Platz fehlte.
    expect(source).toContain('if (isApiError(e) && e.code === "PAYWALL_REQUIRED") {');
    expect(source).toContain(
      'setError("Bild-Occlusion ist eine Pro-Funktion — Pro gibt es in der clearn-App.");',
    );
    // Der Status allein darf nirgends mehr über die Meldung entscheiden.
    expect(source).not.toContain("e.status === 402");
  });

  it("nennt ein volles Deck beim Namen, statt es als Pro-Frage auszugeben (#371)", () => {
    expect(source).toContain('if (isApiError(e) && e.code === "DECK_FULL") {');
    expect(source).toContain(
      'setError("Dieses Deck ist voll. Leg für weitere Karten ein zweites Deck an.");',
    );
  });

  it("zeigt alle anderen Fehler weiterhin unverändert an", () => {
    // Der else-Zweig muss erhalten bleiben: nur 402 wird ersetzt, jeder andere
    // Fehler behält seine bisherige Meldung (sonst schlucken wir echte Fehler).
    expect(source).toContain(
      '} else {\n        setError(isApiError(e) ? e.message : e instanceof Error ? e.message : "Speichern fehlgeschlagen.");\n      }',
    );
  });

  it("rollt Karten und Bild weiterhin zurück, bevor die Meldung gesetzt wird", () => {
    // Der Paywall-Zweig darf das Aufräumen nicht überspringen — sonst bliebe
    // bei jedem Fehlversuch ein verwaistes Bild im Speicher liegen.
    expect(source).toContain("await Promise.allSettled(createdIds.map((id) => deleteCard(id)));");
    expect(source).toContain("await supabase.storage.from(BUCKET).remove([path]).catch(() => {});");
  });
});
