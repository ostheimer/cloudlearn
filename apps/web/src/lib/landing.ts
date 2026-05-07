import { buildConversionPayload } from "./tracking";
import { siteConfig } from "./site";

export const landingCtas = {
  primary: {
    label: "TestFlight-Zugang per E-Mail anfragen",
    href: siteConfig.betaMailto,
    event: buildConversionPayload({
      event: "testflight_request",
      source: "hero",
    }),
  },
  secondary: {
    label: "Support und Kontakt",
    href: `${siteConfig.supportPath}#beta`,
  },
} as const;
