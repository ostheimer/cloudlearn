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

  it("grast JEDE Quellen-Kachel aus, wenn die Deck-Grenze erreicht ist", () => {
    // Im Browser legt jeder Weg ein neues Deck an — es darf keinen geben, der
    // an der Grenze noch Lernpunkte ausgibt. Der Vergleich der beiden Zahlen
    // schlägt auch dann an, wenn jemand später eine sechste Quelle ergänzt und
    // die Sperre vergisst.
    const cards = source.match(/className="source-card source-card--/g) ?? [];
    const guards = source.match(/disabled=\{deckLimitReached\}/g) ?? [];
    expect(cards.length).toBeGreaterThan(0);
    expect(guards.length).toBe(cards.length);
  });

  it("zeigt den Hinweis, statt nur stumm zu sperren", () => {
    expect(source).toContain("{deckLimitHint && (");
    expect(source).toContain("{DECK_LIMIT_LABEL}");
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
