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

  it("lässt an der Deck-Grenze nicht in ein neues Deck speichern", () => {
    // Wanderung der Sperre: #411 sperrte alle Quellen-Kacheln (jeder Weg legte
    // ein neues Deck an), #427 verschob sie ans Absenden (Ziel schon vorher
    // wählbar), und mit der Vorschau sitzt sie am SPEICHERN — dem einzigen
    // Punkt, an dem noch etwas entstehen kann. Beim Erzeugen wäre sie jetzt
    // falsch: Da steht das Ziel noch gar nicht fest.
    expect(source).toContain("const newDeckBlocked = deckLimitReached && targetDeckId === null;");
    const save = source.indexOf("onClick={handleSave}");
    expect(save).toBeGreaterThan(-1);
    const guardArea = source.slice(save, save + 400);
    expect(guardArea).toContain("newDeckBlocked");
  });

  it("sperrt auch das volle Ziel-Deck beim Speichern", () => {
    // Ein volles Deck weist der Server ab — das gehört gesehen, bevor man
    // drückt, nicht danach.
    expect(source).toContain("const targetDeckFull = targetFreeSlots === 0;");
    const save = source.indexOf("onClick={handleSave}");
    expect(source.slice(save, save + 400)).toContain("targetDeckFull");
  });

  it("zeigt den Hinweis, statt nur stumm zu sperren", () => {
    expect(source).toContain("{deckLimitHint && (");
    expect(source).toContain("{DECK_LIMIT_LABEL}");
  });

  it("erzeugt auf JEDEM der vier Wege nur die Vorschau (#427)", () => {
    // Vergisst ein Weg das preview-Flag, speichert der Server ihn sofort — und
    // die Nutzerin sieht ihre Karten erst, wenn das Deck schon steht.
    const calls = source.match(/(scanText|importFromUrl|scanImage|importPdf)\(/g) ?? [];
    expect(calls.length).toBe(4);
    const previewArgs = source.match(/undefined,\s*\n?\s*true/g) ?? [];
    expect(previewArgs.length).toBe(4);
  });

  it("speichert erst auf Knopfdruck, nicht schon beim Erzeugen (#427)", () => {
    const generate = source.indexOf("async function handleSubmit");
    const save = source.indexOf("async function handleSave");
    expect(generate).toBeGreaterThan(-1);
    expect(save).toBeGreaterThan(generate);
    // Der Erzeugen-Zweig endet in der Vorschau, nicht in einer Navigation.
    expect(source).toContain("setDraft(result?.cards ?? []);");
    expect(source).toContain("saveImportedCards({");
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
    expect(source).toContain("setSummary({ text: savedSummary(offered, saved)");
    expect(source).toContain("saved < offered");
  });

  it("springt weiterhin direkt ins Deck, wenn alles passte", () => {
    // Der Normalfall darf keinen Klick dazubekommen.
    expect(source).toContain("router.push(target);");
  });

  it("fragt vor dem Verwerfen einer bezahlten Vorschau nach (#534)", () => {
    // Der Verwerfen-Knopf öffnet erst den App-eigenen Bestätigungsdialog; das
    // eigentliche Löschen (setDraft(null)) sitzt in discardDraft und läuft nur
    // nach Bestätigung im Dialog. So kostet ein Fehlklick weder Karten noch die
    // dafür ausgegebenen Lernpunkte.
    const handler = source.indexOf("function handleDiscard");
    const discardFn = source.indexOf("function discardDraft");
    const opensDialog = source.indexOf("setConfirmDiscard(true)", handler);
    const actualDiscard = source.indexOf("setDraft(null)", handler);

    expect(handler).toBeGreaterThan(-1);
    expect(discardFn).toBeGreaterThan(handler);
    // handleDiscard öffnet den Dialog, bevor irgendetwas gelöscht wird.
    expect(opensDialog).toBeGreaterThan(handler);
    expect(opensDialog).toBeLessThan(actualDiscard);
    // Gelöscht wird erst in discardDraft, nicht schon in handleDiscard.
    expect(actualDiscard).toBeGreaterThan(discardFn);
    // Knopf, Dialog und Bestätigungsaktion sind verdrahtet.
    expect(source).toContain("onClick={handleDiscard}");
    expect(source).toContain("confirmDiscard && draft");
    expect(source).toContain("onClick={discardDraft}");
  });
});
