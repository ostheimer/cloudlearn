import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * #411: Die reinen Funktionen in `import-limits.ts` sind für sich geprüft — das
 * sagt aber nichts darüber, ob die Import-Seite sie auch aufruft. Genau daran
 * hing der Fehler: Die Grenzen existierten serverseitig längst, das Web kannte
 * sie nur nicht. Diese Tests lesen die Seite als Text, wie es
 * `occlusion-paywall-message.test.ts` seit #364 vormacht.
 */
describe("Web-Import-Seite – Plan-Grenzen (#411)", () => {
  const source = readFileSync(join(webRoot, "app/dashboard/import/page.tsx"), "utf-8").replace(
    /\r\n/g,
    "\n"
  );

  it("gibt an der Deck-Grenze keine Lernpunkte für eine sichere Absage aus", () => {
    // Ursprünglich (#411) waren dafür ALLE Quellen-Kacheln gesperrt, weil jeder
    // Weg ein neues Deck anlegte. Mit der Zielauswahl (#427) wäre das zu viel:
    // In ein bestehendes Deck darf man auch an der Grenze importieren. Die
    // Sperre sitzt deshalb jetzt am Absenden — dem einzigen Punkt, an dem
    // Lernpunkte fließen — und greift nur, solange „neues Deck" gewählt ist.
    expect(source).toContain("const newDeckBlocked = deckLimitReached && targetDeckId === null;");
    const submit = source.indexOf('onClick={handleSubmit}');
    const guard = source.indexOf("newDeckBlocked", submit);
    expect(submit).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(submit);
  });

  it("sperrt auch das volle Ziel-Deck vor dem Bezahlen", () => {
    // Ein volles Deck weist der Server ebenso ab wie ein zu volles Konto.
    expect(source).toContain("const targetDeckFull = targetFreeSlots === 0;");
    const submit = source.indexOf('onClick={handleSubmit}');
    expect(source.indexOf("targetDeckFull", submit)).toBeGreaterThan(submit);
  });

  it("zeigt den Hinweis, statt nur stumm zu sperren", () => {
    expect(source).toContain("{deckLimitHint && (");
    expect(source).toContain("{DECK_LIMIT_LABEL}");
  });

  it("reicht das Ziel-Deck an JEDEN der vier Wege durch (#427)", () => {
    // Sonst landet ein Weg still wieder in einem neuen Deck — genau der Fehler,
    // den die App bei PDF und URL bis heute hat.
    const calls = source.match(/(scanText|importFromUrl|scanImage|importPdf)\(/g) ?? [];
    expect(calls.length).toBe(4);
    expect(source).toContain("const deckId = targetDeckId ?? undefined;");
    for (const fragment of ["idemKey, deckId)", "deckId\n        );"]) {
      expect(source).toContain(fragment);
    }
  });

  it("holt die Grenzen vom Server, statt sie im Web zu wiederholen", () => {
    // Eine zweite Zahl im Client wäre beim nächsten Tarif-Umbau sofort falsch.
    expect(source).toContain("usage?.limits?.maxDecks");
    expect(source).not.toMatch(/maxDecks\s*[=:]\s*\d/);
  });

  it("behandelt die Grenz-Ablehnung VOR dem Lernpunkte-Zweig", () => {
    // Sonst schluckt `e.status === 402` sie nie — aber die Reihenfolge ist die
    // eigentliche Falle: Stünde der 402-Zweig zuerst, sähe die Nutzerin bei
    // einer Grenze „deine Lernpunkte reichen nicht" (#371).
    // Geprüft wird die Stelle des ZWEIGS, nicht die der Zuweisung darüber:
    // Beim Mutationstest überlebte die Zuweisung das Entfernen des Zweigs, und
    // eine Prüfung auf ihre Position hätte den Rückbau durchgewinkt.
    const limitBranch = source.indexOf("if (limitMessage) {");
    const lpBranch = source.indexOf("e.status === 402");
    expect(limitBranch).toBeGreaterThan(-1);
    expect(lpBranch).toBeGreaterThan(-1);
    expect(limitBranch).toBeLessThan(lpBranch);
    expect(source).toContain("setError(limitMessage);");
  });

  it("meldet ehrlich, wenn nicht alles ins Deck passte", () => {
    // Ohne diesen Zwischenschritt springt die Seite kommentarlos ins fertige
    // Deck und die fehlenden Karten fallen niemandem auf.
    expect(source).toContain("setSummary({ text: savedSummary(generated, saved)");
    expect(source).toContain("saved < generated");
  });

  it("springt weiterhin direkt ins Deck, wenn alles passte", () => {
    // Der Normalfall darf keinen Klick dazubekommen.
    expect(source).toContain("router.push(target);");
  });
});
