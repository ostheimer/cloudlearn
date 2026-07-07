export const siteConfig = {
  brandName: "clearn.ai",
  appName: "clearn",
  companyName: "Ostheimer OG",
  contactPeople: "Andreas Ostheimer (50%) und Sabine Ostheimer (50%)",
  uid: "ATU79912016",
  companyRegister: "Firmenbuchnummer 613327b",
  streetAddress: "Fabriksgasse 20",
  postalCode: "2230",
  city: "Gänserndorf",
  country: "Österreich",
  supportEmail: "office@ostheimer.at",
  supportPhone: "+43 699 172 635 44",
  supportMailto: "mailto:office@ostheimer.at?subject=clearn%20Support",
  supportPhoneHref: "tel:+4369917263544",
  betaMailto: "mailto:office@ostheimer.at?subject=clearn%20TestFlight",
  privacyPath: "/privacy",
  supportPath: "/support",
  impressumPath: "/impressum",
} as const;

export const siteNavLinks = [
  { href: siteConfig.supportPath, label: "Support" },
  { href: siteConfig.privacyPath, label: "Datenschutz" },
  { href: siteConfig.impressumPath, label: "Impressum" },
] as const;

/**
 * Primary in-page navigation shown in the marketing header.
 * Ordered to follow the page flow: erst "So geht's", dann Features, Lernmodi, FAQ.
 */
export const marketingNavLinks = [
  { href: "/#so-gehts", label: "So geht's" },
  { href: "/#features", label: "Features" },
  { href: "/#lernmodi", label: "Lernmodi" },
  { href: "/#faq", label: "FAQ" },
] as const;

/** Grouped links for the site footer. */
export const footerSections = [
  {
    title: "Produkt",
    links: [
      { href: "/#so-gehts", label: "So geht's" },
      { href: "/#features", label: "Features" },
      { href: "/#lernmodi", label: "Lernmodi" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { href: siteConfig.privacyPath, label: "Datenschutz" },
      { href: siteConfig.impressumPath, label: "Impressum" },
    ],
  },
  {
    title: "Kontakt",
    links: [
      { href: siteConfig.supportPath, label: "Support" },
      { href: siteConfig.supportMailto, label: siteConfig.supportEmail },
    ],
  },
] as const;
