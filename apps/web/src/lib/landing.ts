import { siteConfig } from "./site";

export const landingCtas = {
  primary: {
    // #609: Hieß „TestFlight-Zugang per E-Mail anfragen". TestFlight kennt
    // eine Schülerin nicht. Im Betreff der Mail bleibt das Wort stehen
    // (siteConfig.betaMailto) — dort sortiert es das Postfach, sichtbar ist
    // es für die Nutzerin nicht.
    label: "iPhone-App per E-Mail anfragen",
    href: siteConfig.betaMailto,
  },
  secondary: {
    label: "Support und Kontakt",
    href: `${siteConfig.supportPath}#beta`,
  },
} as const;
