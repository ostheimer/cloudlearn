import { siteConfig } from "./site";

export const landingCtas = {
  primary: {
    label: "TestFlight-Zugang per E-Mail anfragen",
    href: siteConfig.betaMailto,
  },
  secondary: {
    label: "Support und Kontakt",
    href: `${siteConfig.supportPath}#beta`,
  },
} as const;
