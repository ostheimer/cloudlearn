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
  betaMailto: "mailto:office@ostheimer.at?subject=clearn%20Beta",
  privacyPath: "/privacy",
  supportPath: "/support",
  impressumPath: "/impressum",
} as const;

export const siteNavLinks = [
  { href: siteConfig.supportPath, label: "Support" },
  { href: siteConfig.privacyPath, label: "Datenschutz" },
  { href: siteConfig.impressumPath, label: "Impressum" },
] as const;
