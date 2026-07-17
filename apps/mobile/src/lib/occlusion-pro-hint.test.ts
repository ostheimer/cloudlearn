import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const read = (rel: string) => readFileSync(join(mobileRoot, rel), "utf-8").replace(/\r\n/g, "\n");

// #364 (Schritt 2): Occlusion ist serverseitig eine Pro-Funktion (#352). Bisher
// durfte eine Free-Nutzerin erst ein Bild wählen und jedes Kästchen ziehen — und
// nur das Speichern schlug fehl (402 → Paywall). Der Hinweis muss vorher kommen.
describe("mobile occlusion editor – Pro-Hinweis vorab", () => {
  const source = read("app/occlusion-editor.tsx");

  it("fragt den Tarif über den vorhandenen Getter aus src/lib/api ab", () => {
    expect(source).toContain(
      'import { createCard, deleteCard, isApiError, getSubscriptionStatus } from "../src/lib/api";',
    );
    expect(source).toContain("getSubscriptionStatus()");
  });

  it("sperrt NUR bei bestätigtem free — alles andere lässt den Editor arbeiten", () => {
    // Der Kern von fail-open: geprüft wird auf "free", nicht auf !== "pro".
    expect(source).toContain('if (proGate === "free") {');
    expect(source).toContain('setProGate(res.status.tier === "free" ? "free" : "pro");');
  });

  it("fällt bei Fehler oder noch laufender Abfrage offen aus", () => {
    // Startwert "unknown" (läuft noch) und catch → "unknown" (gescheitert)
    // dürfen NIE sperren — durchgesetzt wird die Sperre weiter serverseitig.
    expect(source).toContain('const [proGate, setProGate] = useState<ProGateState>("unknown");');
    expect(source).toContain('.catch(() => {\n        if (!cancelled) setProGate("unknown");\n      });');
  });

  it("verlässt sich NICHT auf useUsageStore (tier ist dort per Default free)", () => {
    // useUsageStore.tier ist "free", solange nichts geladen ist — das würde
    // zahlende Nutzer fälschlich aussperren. Geprüft wird Import und Aufruf,
    // nicht das blosse Wort: der Kommentar im Editor nennt den Store bewusst.
    expect(source).not.toMatch(/^import .*useUsageStore/m);
    expect(source).not.toMatch(/useUsageStore\(/);
  });

  it("schiebt nicht automatisch zur Paywall, sondern nur per Knopfdruck", () => {
    // Ein automatischer Push beim Mount würde beim Zurücktippen sofort wieder
    // feuern: Paywall → zurück → Editor → Paywall.
    expect(source).toContain('onPress={() => router.push("/paywall")}');
    expect(source.match(/router\.push\("\/paywall"\)/g)).toHaveLength(1);
  });
});

describe("mobile deck screen – statisches Pro-Schild an der Occlusion-Zeile", () => {
  const source = read("app/(tabs)/deck/[id].tsx");

  const badge = source.slice(
    source.indexOf("Statisches Pro-Schild"),
    source.indexOf("Bildteile verdecken & abfragen"),
  );

  it("zeigt ein Text-Schild mit dem Wort Pro an der Occlusion-Zeile", () => {
    expect(badge).not.toBe("");
    expect(badge.replace(/\s+/g, " ")).toContain("> Pro </Text>");
  });

  it("nutzt keine Emojis und keine Glyphen", () => {
    // Projektregel: gezeichnete Icons oder Klartext — nichts anderes.
    expect(badge).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("bleibt statisch — kein Tarif-Abruf beim Öffnen eines Decks", () => {
    // Statisch ist Absicht: so kann das Schild niemanden fälschlich sperren und
    // kostet keine zusätzliche Anfrage bei jedem Deck-Öffnen.
    expect(source).not.toContain("getSubscriptionStatus");
  });
});
