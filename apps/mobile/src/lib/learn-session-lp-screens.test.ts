import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const read = (rel: string) => readFileSync(join(mobileRoot, rel), "utf-8").replace(/\r\n/g, "\n");

// #397: Der eigentliche Fix ist die REIHENFOLGE in den Bildschirmen â€” erst die
// laufenden reviewCard-Anfragen abwarten, dann earnLp rufen. Die Unit-Tests zu
// learn-session-lp.ts prÃ¼fen nur das Hilfsmodul: sie bleiben grÃ¼n, selbst wenn
// alle drei Bildschirme wieder in die alte Wettlaufversion zurÃ¼ckfallen.
//
// Die Bildschirme unter app/ haben in dieser Suite keine Laufzeit-Umgebung
// (vitest lÃ¤uft mit environment "node", react-native wird nicht transformiert),
// also wird der Quelltext geprÃ¼ft â€” dieselbe Konvention wie
// occlusion-pro-hint.test.ts und deck-view-load-error.test.ts. Das ist bewusst
// eine Struktur- und keine VerhaltensprÃ¼fung.

const SCREENS: { name: string; rel: string }[] = [
  { name: "learn", rel: "app/(tabs)/learn.tsx" },
  { name: "practice", rel: "app/practice.tsx" },
  { name: "cloze", rel: "app/cloze.tsx" },
  { name: "quiz", rel: "app/quiz.tsx" },
];

for (const { name, rel } of SCREENS) {
  describe(`mobile ${name} â€“ earnLp erst, wenn die Reviews durch sind`, () => {
    const source = read(rel);

    it("hÃ¤ngt jede reviewCard-Anfrage in die Warteliste", () => {
      // Ohne das Sammeln kann der Bildschirm gar nicht wissen, worauf er wartet.
      expect(source).toContain("pendingReviewsRef.current.push(reviewPromise);");
    });

    it("wartet die offenen Reviews ab, BEVOR earnLp lÃ¤uft", () => {
      const waited = source.indexOf("await Promise.allSettled(pendingReviews);");
      const earned = source.indexOf('earnLp("session", reviewedCount)');
      expect(waited).toBeGreaterThan(-1);
      expect(earned).toBeGreaterThan(-1);
      expect(waited).toBeLessThan(earned);
    });

    it("wiederholt earnLp, solange der Server noch nichts gutgeschrieben hat", () => {
      expect(source).toContain("for (let attempt = 0; attempt < maxAttempts; attempt += 1)");
      expect(source).toContain("isSessionEarnFinalized(result, reviewedCount)");
    });
  });
}

describe("mobile occlusion â€“ earnLp erst, wenn die Reviews durch sind", () => {
  const source = read("app/occlusion.tsx");

  it("Ã¼berlÃ¤sst die Ein-Karten-Schwelle dem gemeinsamen Helper", () => {
    const from = source.indexOf("const awardSession = useCallback");
    const to = source.indexOf("useEffect(() =>", from);
    const awardSession = from > -1 && to > from ? source.slice(from, to) : "";

    expect(awardSession).not.toBe("");
    expect(awardSession).toContain("return beginSessionAward(state, count");
    expect(awardSession).not.toMatch(/if\s*\(\s*count\s*</);
  });

  it("hÃ¤ngt jede sendReview-Anfrage in die Warteliste", () => {
    expect(source).toContain("pendingReviewsRef.current.push(reviewPromise);");
  });

  it("wartet die offenen Reviews ab, BEVOR earnLp lÃ¤uft", () => {
    const waited = source.indexOf("await Promise.allSettled(pendingReviews);");
    const earned = source.indexOf('earnLp("session"');
    expect(waited).toBeGreaterThan(-1);
    expect(earned).toBeGreaterThan(-1);
    expect(waited).toBeLessThan(earned);
  });

  it("wiederholt earnLp, solange der Server noch nichts gutgeschrieben hat", () => {
    expect(source).toContain("for (let attempt = 0; attempt < maxAttempts; attempt += 1)");
    expect(source).toContain("isSessionEarnFinalized(res, count)");
  });

  it("sichert LP vor Neustart und nutzt kein awardedRef mehr", () => {
    expect(source).toContain("await awardSession(total);");
    expect(source).not.toContain("awardedRef");
  });
});

describe("mobile cloze â€“ Folgerunden werden weiter abgerechnet", () => {
  const source = read("app/cloze.tsx");

  const from = source.indexOf("const startRound = async (");
  const to = source.indexOf("const handleCheck =");
  const startRound = from > -1 && to > from ? source.slice(from, to) : "";

  it("rechnet schon am Rundenende ab â€” deshalb ist das Scharfmachen nÃ¶tig", () => {
    // Nur weil hier mitten im Bildschirm abgerechnet wird (state.finalized =
    // true), braucht der LÃ¼ckentext Ã¼berhaupt ein ZurÃ¼cksetzen. learn und
    // practice rechnen ausschliesslich beim Verlassen ab.
    expect(source).toContain("void awardSession(reviewedCount);");
  });

  it("macht die Abrechnung beim Rundenstart wieder scharf", () => {
    expect(startRound).not.toBe("");
    expect(startRound).toContain("awardStateRef.current.finalized = false;");
    expect(startRound).toContain("pendingReviewsRef.current = [];");
    expect(startRound).toContain("sessionReviewsRef.current = 0;");
  });

  it("wartet die vorige Gutschrift ab, BEVOR es wieder scharf macht", () => {
    // Andersherum wÃ¤re es wirkungslos: der noch laufende Lauf setzt finalized
    // gleich wieder auf true, nachdem startRound es zurÃ¼ckgesetzt hat.
    expect(startRound).not.toBe("");
    const awaited = startRound.indexOf("await awardSession(");
    const rearmed = startRound.indexOf("awardStateRef.current.finalized = false;");
    expect(awaited).toBeGreaterThan(-1);
    expect(rearmed).toBeGreaterThan(-1);
    expect(awaited).toBeLessThan(rearmed);
  });

  it("nutzt startRound an allen vier StartknÃ¶pfen", () => {
    // Setup â€žâ€œ, â€žâ€œ, â€žâ€œ.
    // Vierter Knopf seit dem Fortsetzen-Angebot: "Weitermachen" nimmt die
    // unterbrochene Runde an ihrer Position auf. Gezaehlt wird nur, was ueber
    // startRound geht â€” ein Startknopf, der die Runde direkt setzt, wuerde die
    // Abrechnung nicht scharf machen und die Folgerunde ohne LP laufen lassen.
    expect(source.match(/void startRound\(/g)).toHaveLength(4);
  });
});

describe("mobile quiz â€“ meldet sofort und rechnet Folgerunden ab", () => {
  const source = read("app/quiz.tsx");

  const from = source.indexOf("const beginRound = async (");
  const to = source.indexOf("const startQuiz =");
  const beginRound = from > -1 && to > from ? source.slice(from, to) : "";

  it("meldet jede Antwort sofort beim Antippen", () => {
    // #566: Vorher sammelte reportRound bis zum Rundenende â€” wer Ã¼ber den
    // Header-â€žAbbrechen" ging, verlor Streak, Statistik und Lernpunkte.
    // Gemeldet wird deshalb IM handleSelect, nicht erst in handleNext.
    const selFrom = source.indexOf("const handleSelect =");
    const selTo = source.indexOf("const handleNext =");
    const handleSelect = selFrom > -1 && selTo > selFrom ? source.slice(selFrom, selTo) : "";
    expect(handleSelect).not.toBe("");
    expect(handleSelect).toContain('mode: "quiz"');
    expect(handleSelect).toContain("pendingReviewsRef.current.push(reviewPromise);");
  });

  it("sammelt nicht mehr Ã¼ber finishRateModeRound", () => {
    // Der Rundenend-Sammler lebt nur noch in match.tsx weiter â€” dort steht
    // das Urteil je Karte erst mit der Auswertung fest.
    expect(source).not.toContain("finishRateModeRound");
  });

  it("rechnet im Blur-Cleanup ab â€” der Header-â€žAbbrechenâ€œ hat keinen eigenen Handler", () => {
    expect(source).toContain("awardStateRef.current = { finalized: false, inFlight: null };");
    expect(source).toContain("void awardSession(reviewedCount);");
  });

  it("macht die Abrechnung beim Rundenstart wieder scharf", () => {
    // Wie cloze.startRound: handleNext schreibt am Rundenende gut (finalized),
    // â€žAlle nochmal" / â€žNur die nicht gewussten" liefen sonst ohne LP.
    expect(beginRound).not.toBe("");
    expect(beginRound).toContain("awardStateRef.current.finalized = false;");
    expect(beginRound).toContain("pendingReviewsRef.current = [];");
    expect(beginRound).toContain("sessionReviewsRef.current = 0;");
  });

  it("wartet die vorige Gutschrift ab, BEVOR es wieder scharf macht", () => {
    expect(beginRound).not.toBe("");
    const awaited = beginRound.indexOf("await awardSession(");
    const rearmed = beginRound.indexOf("awardStateRef.current.finalized = false;");
    expect(awaited).toBeGreaterThan(-1);
    expect(rearmed).toBeGreaterThan(-1);
    expect(awaited).toBeLessThan(rearmed);
  });

  it("nutzt beginRound an beiden Startwegen", () => {
    // startQuiz (â€žStarten", â€žAlle nochmal") und startQuizFrom (â€žNur die nicht
    // gewussten") mÃ¼nden beide in beginRound â€” ein Startweg daran vorbei
    // wÃ¼rde die Folgerunde ohne Abrechnung laufen lassen.
    expect(source.match(/void beginRound\(/g)).toHaveLength(2);
  });
});

describe("mobile learn/practice – rechnen bei FERTIG ab, nicht erst beim Verlassen", () => {
  // Umkehr des früheren Tests (#611). Der hielt fest, dass beide Bildschirme NUR
  // im Blur-Cleanup abrechnen — und hängte daran die Warnung: „Kommt hier je ein
  // zweiter awardSession-Aufruf dazu, braucht der Bildschirm dasselbe
  // Scharfmachen wie cloze.startRound."
  //
  // Genau das ist jetzt passiert, absichtlich: Solange erst beim Verlassen
  // abgerechnet wurde, konnte das Ergebnis nichts über Punkte sagen. Also prüfen
  // wir jetzt die Bedingungen, die die Umstellung sicher machen.
  for (const rel of ["app/(tabs)/learn.tsx", "app/practice.tsx"]) {
    describe(rel, () => {
      const source = read(rel);

      it("rechnet ab, sobald die Runde fertig ist", () => {
        // Ohne diesen Aufruf steht am Ergebnis nie eine Punktzahl. Geprüft wird
        // der completed-Effekt selbst (von `if (!completed` bis zu seiner
        // Abhängigkeitsliste), nicht ein Zeichenabstand — Kommentare dürfen
        // beliebig lang werden.
        const start = source.indexOf("if (!completed");
        expect(start).toBeGreaterThan(-1);
        const effect = source.slice(start, source.indexOf("}, [completed]);", start));
        expect(effect).toContain("awardSession(");
      });

      it("behält den Blur-Cleanup als Netz", () => {
        // Wer die Runde ABBRICHT, hat trotzdem Karten gelernt. Diese Gutschrift
        // hängt an #153 und darf nicht verloren gehen.
        expect(source).toContain("awardStateRef.current = { finalized: false, inFlight: null };");
        expect(source).toContain("await awardSession(reviewedCount);");
      });

      it("macht Folgerunden wieder scharf — sonst laufen sie ohne Punkte", () => {
        // Das war die Warnung des alten Tests: `finalized` steht nach der
        // completed-Abrechnung auf true, und die Wiederholungsknöpfe starten
        // ohne neuen Fokus.
        expect(source).toContain("rearmForNextRound");
        expect(source).toContain("awardStateRef.current.finalized = false;");
      });

      it("entschärft in der richtigen Reihenfolge (erst abrechnen, dann freigeben)", () => {
        // Andernfalls setzt der noch laufende Lauf finalized wieder auf true,
        // NACHDEM es zurückgesetzt wurde (Begründung in cloze.startRound).
        const rearm = source.slice(source.indexOf("const rearmForNextRound"));
        const awaited = rearm.indexOf("await awardSession(");
        const released = rearm.indexOf("awardStateRef.current.finalized = false;");
        expect(awaited).toBeGreaterThan(-1);
        expect(released).toBeGreaterThan(awaited);
      });

      it("setzt die Punkte-Anzeige für die Folgerunde zurück", () => {
        // Eine stehen gebliebene Zahl würde für die neue Runde eine Gutschrift
        // behaupten, die noch nicht erfolgt ist.
        const rearm = source.slice(source.indexOf("const rearmForNextRound"));
        expect(rearm).toContain("setEarnedLp(0);");
        expect(rearm).toContain("setEarnCapReached(false);");
      });
    });
  }
});

describe("alle Lern-Modi sagen den Tagesdeckel (#611)", () => {
  // Vorher zeigte ihn NUR Bild-Abdecken, dort hartkodiert. Quiz und Zuordnen
  // hatten eine Pille, die bei 0 Punkten verschwand — wer 20 Karten lernte und
  // keine Punkte bekam, hielt es für einen Fehler.
  const MODES = [
    "app/(tabs)/learn.tsx",
    "app/practice.tsx",
    "app/cloze.tsx",
    "app/quiz.tsx",
    "app/match.tsx",
    "app/occlusion.tsx",
  ];

  for (const rel of MODES) {
    it(`${rel}: nimmt capReached an und zeigt die geteilte Zusammenfassung`, () => {
      const source = read(rel);
      // Der Wert kam in der earn-Antwort schon immer mit; entscheidend ist, dass
      // er nicht weggeworfen wird.
      expect(source).toContain("earnCapReached");
      // Eine gemeinsame Komponente statt sechs Kopien: so kann der Wortlaut
      // nicht auseinanderlaufen und kein Modus den Deckel verschweigen.
      expect(source).toContain("<LpRoundSummary");
    });
  }

  it("hat den Deckel-Satz nirgends mehr hartkodiert", () => {
    // In occlusion.tsx stand er als String-Literal. Jetzt kommt er aus
    // resources.ts (de+en) über LpRoundSummary.
    for (const rel of MODES) {
      expect(read(rel)).not.toContain("Heutiges Lernpunkte-Limit erreicht");
    }
  });
});
