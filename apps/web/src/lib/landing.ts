import { siteConfig } from "./site";

export const landingCtas = {
  primary: {
    label: "Im App Store herunterladen",
    href: siteConfig.appStoreUrl,
  },
  secondary: {
    label: "Support und Kontakt",
    href: `${siteConfig.supportPath}#beta`,
  },
} as const;
