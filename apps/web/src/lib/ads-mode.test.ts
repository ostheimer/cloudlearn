import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { REAL_ADS_ENABLED } from "./ads-mode";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../..");

// #611: Das Web spiegelt den Werbe-Schalter der App, damit die LP-Seite nicht
// „+5 LP pro Video" als Weg anpreist, solange Werbung 0 LP liefert. Eine Kopie
// veraltet still — dieser Test verhindert genau das.
describe("Werbe-Schalter Web/App im Gleichschritt (#611)", () => {
  const appSource = readFileSync(
    join(repoRoot, "apps/mobile/src/features/ads/adsMode.ts"),
    "utf-8",
  );

  it("findet die App-Konstante überhaupt (sonst prüft der Test unten Luft)", () => {
    expect(appSource).toMatch(/export const REAL_ADS_ENABLED: boolean = (true|false);/);
  });

  it("hat denselben Wert wie die App", () => {
    // Läuft das auseinander, verspricht eine der beiden Oberflächen Punkte, die
    // die andere nicht auszahlt. Wird Werbung scharfgeschaltet (#149), müssen
    // BEIDE Konstanten umgestellt werden — dieser Test sagt, welche fehlt.
    const match = appSource.match(/export const REAL_ADS_ENABLED: boolean = (true|false);/);
    const appValue = match?.[1] === "true";
    expect(REAL_ADS_ENABLED).toBe(appValue);
  });

  it("verweist auf die App-Datei, damit der Zusammenhang auffindbar bleibt", () => {
    const webSource = readFileSync(
      join(repoRoot, "apps/web/src/lib/ads-mode.ts"),
      "utf-8",
    );
    expect(webSource).toContain("apps/mobile/src/features/ads/adsMode.ts");
  });
});
