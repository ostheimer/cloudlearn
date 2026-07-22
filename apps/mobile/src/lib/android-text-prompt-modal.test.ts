import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const read = (rel: string) => readFileSync(join(mobileRoot, rel), "utf-8").replace(/\r\n/g, "\n");

/**
 * Treffer zählen. Bewusst über `?? []` statt `.match(...)` direkt zu prüfen:
 * ohne Treffer liefert match `null`, und die Meldung hiesse dann nur
 * „Target cannot be null" statt „erwartet 1, bekommen 0".
 */
const countOf = (source: string, pattern: RegExp) => (source.match(pattern) ?? []).length;

/** Alle .ts/.tsx-Dateien unter app/ und src/ — ohne node_modules und Tests. */
function appSourceFiles(): string[] {
  const out: string[] = [];
  const walk = (abs: string, rel: string) => {
    for (const entry of readdirSync(abs)) {
      if (entry === "node_modules") continue;
      const childAbs = join(abs, entry);
      const childRel = rel ? `${rel}/${entry}` : entry;
      if (statSync(childAbs).isDirectory()) walk(childAbs, childRel);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(childRel);
    }
  };
  walk(join(mobileRoot, "app"), "app");
  walk(join(mobileRoot, "src"), "src");
  return out;
}

// Der gesuchte Name wird zusammengesetzt, damit diese Datei ihn selbst nicht
// enthält: sonst fände eine Suche über apps/mobile für immer einen Treffer.
const iosOnlyCall = ["Alert", "prompt"].join(".");

// #396: Der Eingabe-Alert von React Native existiert ausschliesslich auf iOS.
// Auf Android verpufft der Aufruf wirkungslos — „Kurs anlegen", „Ordner
// anlegen" und jedes Umbenennen waren dort tote Knöpfe. Eine einzige übersehene
// Stelle heisst: dort bleibt Android kaputt. Deshalb wird der GESAMTE
// Quellbaum geprüft, nicht nur die sieben bekannten Dateien.
describe("mobile – kein iOS-only Eingabe-Alert mehr (#396)", () => {
  it("ruft ihn in keiner einzigen Quelldatei auf", () => {
    const offenders = appSourceFiles().filter((rel) => read(rel).includes(iosOnlyCall));
    expect(offenders).toEqual([]);
  });

  it("umgeht ihn auch nicht über einen freistehenden prompt-Aufruf", () => {
    // Fängt Umwege wie `const { prompt } = Alert; prompt(...)` ab.
    // Kommentare fliegen vorher raus: Fliesstext wie „a generic prompt (…)"
    // ist kein Aufruf. Das `[^:]` schützt dabei URLs wie https:// davor,
    // fälschlich als Kommentaranfang gelesen zu werden.
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const pattern = new RegExp(String.raw`\b` + "prompt" + String.raw`\s*\(`);
    const offenders = appSourceFiles().filter((rel) => pattern.test(stripComments(read(rel))));
    expect(offenders).toEqual([]);
  });
});

// Seit #437 gibt es keine Kurse mehr — übrig sind die Bibliothek (Deck
// umbenennen, Ordner anlegen/umbenennen) und die Ordner-Detailseite.
describe("mobile – alle vier Stellen benutzen TextPromptModal", () => {
  const decks = read("app/(tabs)/decks.tsx");
  const folder = read("app/(tabs)/library-folder/[id].tsx");

  it("bindet das Fenster in beiden Bildschirmen ein", () => {
    expect(decks).toContain('import TextPromptModal from "../../src/components/TextPromptModal";');
    expect(folder).toContain('import TextPromptModal from "../../../src/components/TextPromptModal";');
    for (const source of [decks, folder]) {
      expect(source).toContain("<TextPromptModal");
    }
  });

  it("deckt in decks.tsx alle drei Stellen ab", () => {
    // Deck umbenennen, Ordner anlegen/umbenennen.
    expect(decks).toContain('setPrompt({ kind: "renameDeck", deck })');
    expect(decks).toContain('setPrompt({ kind: "createFolder" })');
    expect(decks).toContain('setPrompt({ kind: "renameFolder", folder })');
  });

  it("öffnet das Umbenennen-Fenster in der Detailseite", () => {
    expect(folder).toContain("setRenamePromptVisible(true)");
  });

  it("zeigt je Fall ein passendes gezeichnetes Symbol", () => {
    // Lara will das Symbol ausdrücklich behalten — je Kontext das der Liste.
    expect(decks).toContain("icon: Layers"); // Deck
    expect(decks).toContain("icon: FolderOpen"); // Ordner
    expect(folder).toContain("icon={FolderOpen}");
  });
});

// Der Umbau darf NUR die Hülle tauschen. Geprüft wird deshalb im jeweiligen
// Speichern-Block, dass Prüfung, API-Aufruf, Fehlermeldung und Nachladen
// dieselben geblieben sind — nicht bloss irgendwo in der Datei.
describe("mobile – Verhalten je Stelle unverändert", () => {
  const decks = read("app/(tabs)/decks.tsx");
  const folder = read("app/(tabs)/library-folder/[id].tsx");

  const decksSubmit = decks.slice(
    decks.indexOf("const handlePromptSubmit"),
    decks.indexOf("// --- Navigation ---"),
  );
  const folderSubmit = folder.slice(
    folder.indexOf("const handleRenameSubmit"),
    folder.indexOf("const handleDeleteFolder"),
  );

  it("findet die Speichern-Blöcke überhaupt", () => {
    for (const block of [decksSubmit, folderSubmit]) {
      expect(block).not.toBe("");
    }
  });

  it("verwirft leere und reine Leerzeichen-Namen an jeder der vier Stellen", () => {
    // Drei Wächter in decks.tsx, einer in der Detailseite = 4.
    expect(countOf(decksSubmit, /if \(!value\.trim\(\)/g)).toBe(3);
    expect(countOf(folderSubmit, /if \(!value\.trim\(\)/g)).toBe(1);
  });

  it("verlangt beim Anlegen zusätzlich ein angemeldetes Konto", () => {
    // Ordner anlegen hatte schon immer `|| !userId`.
    expect(countOf(decksSubmit, /if \(!value\.trim\(\) \|\| !userId\) return;/g)).toBe(1);
  });

  it("ruft dieselben Schnittstellen mit gekürztem Namen auf", () => {
    expect(decksSubmit).toContain("await updateDeck(current.deck.id, { title: value.trim() });");
    expect(decksSubmit).toContain("await createFolder(value.trim());");
    expect(decksSubmit).toContain("await updateFolderApi(current.folder.id, { title: value.trim() });");
    expect(folderSubmit).toContain("await updateFolderApi(folderId, { title: value.trim() });");
  });

  it("meldet Fehler weiterhin mit denselben Texten", () => {
    expect(decksSubmit).toContain('t("library.renameDeckError")');
    expect(decksSubmit).toContain('t("folder.createError")');
    expect(decksSubmit).toContain('t("library.renameFolderError")');
    expect(folderSubmit).toContain('t("folderDetail.renameError")');
  });

  it("lädt nach dem Speichern wie bisher neu bzw. setzt den Titel", () => {
    expect(decksSubmit).toContain("loadDecks();");
    expect(decksSubmit).toContain("loadFolders();");
    expect(folderSubmit).toContain("setCurrentTitle(value.trim());");
  });

  it("schliesst das Fenster beim Bestätigen — wie zuvor der Alert", () => {
    expect(decksSubmit).toContain("setPrompt(null);");
    expect(folderSubmit).toContain("setRenamePromptVisible(false);");
  });

  it("belegt beim Umbenennen den bisherigen Namen vor", () => {
    expect(decks).toContain("initialValue: prompt.deck.title");
    expect(decks).toContain("initialValue: prompt.folder.title");
    expect(folder).toContain("initialValue={currentTitle}");
  });

  it("startet das Anlegen weiterhin mit leerem Feld", () => {
    expect(countOf(decks, /initialValue: "",/g)).toBe(1);
  });

  it("behält dieselben Überschriften und Knopftexte", () => {
    expect(decks).toContain('title: t("library.renameDeck")');
    expect(decks).toContain('title: t("library.newFolder")');
    expect(decks).toContain('title: t("library.renameFolder")');
    // Anlegen sagt „Erstellen", Umbenennen sagt „Speichern" — wie vorher.
    expect(countOf(decks, /confirmLabel: t\("library\.create"\)/g)).toBe(1);
    expect(countOf(decks, /confirmLabel: t\("common\.save"\)/g)).toBe(2);
    expect(folder).toContain('confirmLabel={t("common.save")}');
  });

  it("behält dieselben Beschriftungen über dem Feld", () => {
    expect(decks).toContain('label: t("library.renamePrompt", { title: prompt.deck.title })');
    expect(decks).toContain('label: t("library.newFolderPrompt")');
    expect(decks).toContain('label: t("library.renamePrompt", { title: prompt.folder.title })');
    expect(folder).toContain('label={t("folderDetail.renamePrompt")}');
  });
});

describe("mobile – TextPromptModal selbst", () => {
  const source = read("src/components/TextPromptModal.tsx");

  it("fährt von unten herein statt als Kasten in der Mitte", () => {
    expect(source).toContain('animationType="slide"');
    expect(source).toContain("transparent");
    expect(source).toContain('justifyContent: "flex-end"');
  });

  it("setzt den Schreibzeiger sofort ins Feld", () => {
    expect(source).toContain("autoFocus");
  });

  it("speichert auch über die Eingabetaste — ausser im mehrzeiligen Modus", () => {
    // Mehrzeilig (Ordner-Beschreibung, #437) macht die Eingabetaste zum
    // Zeilenumbruch; einzeilig speichert sie weiterhin.
    expect(source).toContain('returnKeyType={multiline ? "default" : "done"}');
    expect(source).toContain("onSubmitEditing={multiline ? undefined : handleSubmit}");
  });

  it("lässt sich per Zurück-Taste und per Tipp daneben schliessen", () => {
    // onRequestClose ist die Android-Zurück-Taste.
    expect(source).toContain("onRequestClose={onCancel}");
    expect(source).toContain("<Pressable style={{ flex: 1 }} onPress={onCancel}");
  });

  it("hält die Tastatur vom Eingabefeld fern", () => {
    expect(source).toContain("KeyboardAvoidingView");
    expect(source).toContain('behavior={Platform.OS === "ios" ? "padding" : "height"}');
  });

  it("lässt leere Namen gar nicht erst durch — ausser wo leer erlaubt ist", () => {
    // allowEmpty gibt es nur für die Ordner-Beschreibung (#437): dort ist
    // leer speichern der Weg, sie zu löschen. Namen bleiben Pflicht.
    expect(source).toContain("const isValid = allowEmpty || value.trim().length > 0;");
    expect(source).toContain("if (!isValid) return;");
    expect(source).toContain("disabled={!isValid}");
  });

  it("zeigt das vom Bildschirm gelieferte Symbol neben der Überschrift", () => {
    expect(source).toContain("icon: Icon,");
    expect(source).toContain("<Icon size={22} color={colors.primary} />");
  });

  it("stellt Speichern über Abbrechen — gefüllt gegen zurückhaltend", () => {
    expect(source).toContain("backgroundColor: isValid ? colors.primary : colors.textTertiary");
    expect(source).toContain("backgroundColor: colors.surfaceSecondary");
  });

  it("setzt das Feld bei jedem Öffnen zurück", () => {
    // Sonst stünde beim nächsten Umbenennen noch der vorige Name im Feld.
    expect(source).toContain('if (visible) setValue(initialValue ?? "");');
  });

  it("nutzt keine Emojis und keine Glyphen", () => {
    // Projektregel: gezeichnete Icons oder Klartext — nichts anderes.
    expect(source).not.toMatch(/\p{Extended_Pictographic}/u);
    // Pfeile, Dingbats und Symbol-Blöcke (Haken, Kreuze, …) ebenfalls nicht.
    expect(source).not.toMatch(/[←-⇿⌀-➿⬀-⯿]/u);
  });
});
