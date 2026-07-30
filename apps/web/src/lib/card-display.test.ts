import { describe, expect, it } from "vitest";
import {
  cardDeleteQuestion,
  cardListPreview,
  cleanTerm,
  formatCloze,
  parseMarkdownImages,
  stripMarkdownImages,
  summarizeCardMedia,
} from "./card-display";

// Nachgebaut aus apps/mobile/src/lib/cardMedia.test.ts — gleiche Fälle,
// damit Web und App nachweislich dieselbe Aufbereitung teilen.
describe("cardMedia-Helfer", () => {
  it("liest Bild-Verweise mit Beschriftung und URL aus dem Text", () => {
    const text =
      "Beschrifte das Element ![Gallery Item](https://example.com/gallery.png) korrekt.";
    const images = parseMarkdownImages(text);

    expect(images).toHaveLength(1);
    expect(images[0]?.alt).toBe("Gallery Item");
    expect(images[0]?.url).toBe("https://example.com/gallery.png");
  });

  it("entfernt Bild-Markdown und behält den lesbaren Text", () => {
    const cleaned = stripMarkdownImages(
      "![Komponente](https://example.com/a.png) Das ist ein Button."
    );
    expect(cleaned).toBe("Das ist ein Button.");
  });

  it("baut die Medien-Zusammenfassung mit Hauptbild und bevorzugter Beschriftung", () => {
    const summary = summarizeCardMedia({
      front: "Was ist dargestellt? ![Card](https://example.com/card.png)",
      back: "Info Card",
    });

    expect(summary.primaryImage?.url).toBe("https://example.com/card.png");
    expect(summary.plainFront).toBe("Was ist dargestellt?");
    expect(summary.preferredLabel).toBe("Info Card");
  });

  it("eine reine Bild-Seite ergibt leeren Text und fällt auf die Beschriftung zurück", () => {
    const summary = summarizeCardMedia({
      front: "![Zellkern](https://example.com/zelle.png)",
      back: "",
    });
    expect(summary.plainFront).toBe("");
    expect(summary.preferredLabel).toBe("Zellkern");
  });
});

// Nachgebaut aus apps/mobile/src/lib/cardTerms.test.ts.
describe("cleanTerm", () => {
  it("zieht den Begriff aus einer Übersetzungsfrage", () => {
    expect(cleanTerm("Was bedeutet 'le record' auf Deutsch?")).toBe("le record");
    expect(cleanTerm("Wie heißt 'la chaleur' auf Deutsch?")).toBe("la chaleur");
    expect(cleanTerm("Was heißt 'le soleil' auf Französisch?")).toBe("le soleil");
    expect(cleanTerm("Übersetze: 'la moitié'")).toBe("la moitié");
  });

  it("versteht deutsche und typografische Anführungszeichen", () => {
    expect(cleanTerm("Was bedeutet „le record“ auf Deutsch?")).toBe("le record");
    expect(cleanTerm("Was bedeutet ‘le record’ auf Deutsch?")).toBe("le record");
  });

  it("lässt echte Sachfragen unverändert", () => {
    expect(cleanTerm("Was ist ein Intervall?")).toBe("Was ist ein Intervall?");
    expect(cleanTerm("Nenne die Teile eines Taktes")).toBe("Nenne die Teile eines Taktes");
  });

  it("lässt Definitionsfragen ohne Zielsprache unverändert", () => {
    // "bedeutet" allein reicht nicht — ohne Zielsprache bleibt es eine
    // Definitionsfrage, deren Antwort die Definition ist, nicht das Zitat.
    expect(cleanTerm("Was bedeutet 'Legato'?")).toBe("Was bedeutet 'Legato'?");
  });

  it("lässt schlichte Antworten unverändert", () => {
    expect(cleanTerm("der Rekord")).toBe("der Rekord");
    expect(cleanTerm("die Hälfte")).toBe("die Hälfte");
    expect(cleanTerm("")).toBe("");
  });

  it("greift nur, wenn wirklich ein zitierter Begriff da ist", () => {
    expect(cleanTerm("Übersetze diesen Satz auf Deutsch")).toBe(
      "Übersetze diesen Satz auf Deutsch"
    );
  });
});

// formatCloze stammt aus der App-Lernansicht (apps/mobile/app/(tabs)/learn.tsx).
describe("formatCloze", () => {
  it("ersetzt die Lücke durch den Strich und liefert die Lösung", () => {
    const parsed = formatCloze("Die Hauptstadt von Frankreich ist {{c1::Paris}}.");
    expect(parsed.display).toBe("Die Hauptstadt von Frankreich ist ______.");
    expect(parsed.clozeAnswer).toBe("Paris");
  });

  it("ersetzt mehrere Lücken, die Lösung ist die der ersten", () => {
    const parsed = formatCloze("{{c1::Wasser}} besteht aus {{c2::H2O}}.");
    expect(parsed.display).toBe("______ besteht aus ______.");
    expect(parsed.clozeAnswer).toBe("Wasser");
  });

  it("lässt Text ohne Lücke unverändert", () => {
    const parsed = formatCloze("Was ist Photosynthese?");
    expect(parsed.display).toBe("Was ist Photosynthese?");
    expect(parsed.clozeAnswer).toBeNull();
  });

  it("nutzt auf Wunsch einen anderen Platzhalter (Sprech-Pause fürs Vorlesen)", () => {
    const parsed = formatCloze("Berlin liegt an der {{c1::Spree}}.", "…");
    expect(parsed.display).toBe("Berlin liegt an der ….");
    expect(parsed.clozeAnswer).toBe("Spree");
  });
});

describe("cardListPreview — Kartenliste zeigt keinen Rohtext mehr (#612)", () => {
  it("macht aus dem Lücken-Code einen Strich, statt die Lösung zu drucken", () => {
    const preview = cardListPreview({
      front: "Das {{c1::Mitochondrium}} ist das Kraftwerk der Zelle.",
      back: "Mitochondrium",
    });

    expect(preview.front).toBe("Das ______ ist das Kraftwerk der Zelle.");
    // Der rohe Code stand vorher direkt in der Liste — samt Lösung.
    expect(preview.front).not.toContain("{{c1::");
    expect(preview.front).not.toContain("Mitochondrium");
  });

  it("zeigt kein Bild-Markdown, sondern die Bildunterschrift", () => {
    const preview = cardListPreview({
      front: "![Zellkern](https://example.com/zelle.png)",
      back: "Der Zellkern",
    });

    expect(preview.front).toBe("Zellkern");
    expect(preview.front).not.toContain("![");
    expect(preview.front).not.toContain("https://");
    expect(preview.hasImage).toBe(true);
  });

  it("meldet ein Bild ohne Unterschrift, statt eine leere Zeile zu liefern", () => {
    const preview = cardListPreview({
      front: "![](https://example.com/zelle.png)",
      back: "Der Zellkern",
    });

    // Kein Text uebrig — die Liste zeigt dafuer "(Bild)" statt einer Luecke.
    expect(preview.front).toBe("");
    expect(preview.hasImage).toBe(true);
  });

  it("laesst gewoehnliche Karten unveraendert", () => {
    const preview = cardListPreview({ front: "la courbe", back: "die Kurve" });

    expect(preview).toEqual({ front: "la courbe", back: "die Kurve", hasImage: false });
  });
});

// Muss zur App passen (apps/mobile/src/lib/cardDisplay.test.ts) — dieselben
// Erwartungen stehen dort noch einmal (#571).
describe("cardDeleteQuestion", () => {
  it("quotes the card so you see which one is meant", () => {
    expect(cardDeleteQuestion({ front: "Was ist ein Ribosom?", back: "Organell" })).toBe(
      'Soll „Was ist ein Ribosom?" wirklich gelöscht werden? Das lässt sich nicht rückgängig machen.'
    );
  });

  it("shortens a long front to 50 characters plus an ellipsis", () => {
    const front = "A".repeat(80);
    expect(cardDeleteQuestion({ front, back: "b" })).toContain(`„${"A".repeat(50)}…"`);
  });

  it("shows the gap of a cloze card as a blank, never the raw {{c1::…}}", () => {
    const q = cardDeleteQuestion({ front: "Die Hauptstadt ist {{c1::Wien}}", back: "" });
    expect(q).not.toContain("{{c1::");
    expect(q).not.toContain("Wien");
  });

  it("asks without a quote when the front is only an image without a caption", () => {
    expect(cardDeleteQuestion({ front: "![](https://example.com/a.png)", back: "" })).toBe(
      "Soll diese Karte wirklich gelöscht werden? Das lässt sich nicht rückgängig machen."
    );
  });
});
