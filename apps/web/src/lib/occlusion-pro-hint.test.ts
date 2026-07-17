import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

// #364 (Schritt 2): Occlusion ist serverseitig eine Pro-Funktion (#352). Bisher
// durfte eine Free-Nutzerin erst ein Bild wählen und jedes Kästchen ziehen — und
// nur das Speichern schlug fehl. Der Hinweis muss VOR der Arbeit kommen.
describe("web occlusion editor – Pro-Hinweis vorab", () => {
  const source = readFileSync(
    join(webRoot, "app/dashboard/deck/[id]/occlusion/new/page.tsx"),
    "utf-8",
  ).replace(/\r\n/g, "\n");

  it("fragt den Tarif über den vorhandenen Getter ab (kein paralleler Helfer)", () => {
    // getLpBalance() ist der bestehende Weg zum Tarif im Web — die Profil-Seite
    // liest ihn schon genauso. src/lib/api.ts bleibt dabei unangetastet.
    expect(source).toContain('import { createCard, deleteCard, isApiError, getLpBalance } from "@/lib/api";');
    expect(source).toContain("getLpBalance()");
  });

  it("sperrt NUR bei bestätigtem free — alles andere lässt den Editor arbeiten", () => {
    // Der Kern von fail-open: die Bedingung prüft auf "free", nicht auf
    // !== "pro". Sonst würde jeder unbekannte Zustand aussperren.
    expect(source).toContain('if (proGate === "free") {');
    expect(source).toContain('setProGate(u.tier === "free" ? "free" : "pro");');
  });

  it("fällt bei Fehler oder noch laufender Abfrage offen aus", () => {
    // Startwert "unknown" (Abfrage läuft) und catch → "unknown" (Abfrage
    // gescheitert) dürfen NIE sperren: eine wacklige Verbindung darf niemanden
    // aussperren, der bezahlt hat. Die echte Sperre sitzt weiter im Server.
    expect(source).toContain('const [proGate, setProGate] = useState<ProGate>("unknown");');
    expect(source).toContain('.catch(() => {\n        if (!cancelled) setProGate("unknown");\n      });');
  });

  it("nennt den App-Kaufweg und baut keinen Schein-Kauf-Knopf ins Web", () => {
    // Nur der Hinweis-Block, nicht die ganze Datei: der #370-Kommentar weiter
    // unten zitiert die englische Server-Meldung („Upgrade to unlock it.") und
    // würde eine Suche über die Gesamtdatei fälschlich auslösen.
    const notice = source.slice(
      source.indexOf('if (proGate === "free") {'),
      source.indexOf("const drawBox = draw"),
    );
    expect(notice).not.toBe("");
    // Wortlaut wie die Speichern-Meldung aus #370.
    expect(notice).toContain(
      "<p>Bild-Occlusion ist eine Pro-Funktion — Pro gibt es in der clearn-App.</p>",
    );
    // Das Web hat keinen Kaufweg (#368) — ein Kauf-Knopf wäre eine Sackgasse.
    // Der einzige Ausweg ist der Rückweg ins Deck.
    expect(notice).not.toMatch(/kaufen|upgrade|checkout|abo|preis/i);
    expect(notice).toContain("Zurück zum Deck");
  });
});
