import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const files = {
  fillIn: path.join(repoRoot, "docs/runbooks/app-store-connect-fill-in.md"),
  metadata: path.join(repoRoot, "docs/aso/store-metadata-draft.md"),
  asoChecklist: path.join(repoRoot, "docs/aso/checklist.md"),
  reviewNotes: path.join(repoRoot, "docs/runbooks/app-store-review-notes.md"),
  screenshots: path.join(repoRoot, "docs/screens/app-store/README.md"),
  productIdentities: path.join(repoRoot, "docs/runbooks/product-identities.md"),
};

const expected = {
  appName: "clearn",
  bundleId: "app.clearn",
  sku: "app.clearn",
  appStoreConnectAppId: "6766691399",
  category: "Bildung",
  provider: "Ostheimer OG",
  copyright: "2026 Ostheimer OG",
  supportUrl: "https://clearn-web.vercel.app/support",
  marketingUrl: "https://clearn-web.vercel.app",
  privacyUrl: "https://clearn-web.vercel.app/privacy",
  impressumUrl: "https://clearn-web.vercel.app/impressum",
  subtitleDe: "Aus Fotos Karteikarten machen",
  subtitleEn: "Turn notes into flashcards",
  promotionDe:
    "Fotografiere Lernmaterial, erstelle Karteikarten und wiederhole sie direkt auf deinem iPhone.",
  productIds: [
    "ai.clearn.pro.monthly",
    "ai.clearn.pro.annual",
    "ai.clearn.lifetime",
  ],
  entitlements: ["pro", "lifetime"],
  requiredReviewPhrases: [
    "ohne Konto",
    "E-Mail/Passwort",
    "Apple Sign-In",
    "Google Sign-In",
    "Neues Passwort setzen",
    "ATT-Opt-in",
    "Konto-Löschung",
  ],
  screenshotIds: ["01-home", "02-scan", "03-deck", "04-learn", "05-profile"],
};

const maxLengths = {
  subtitle: 30,
  promotion: 170,
  keywords: 100,
  description: 4000,
};

const docs = {};
const failures = [];

function readDoc(label, filePath) {
  if (!fs.existsSync(filePath)) {
    record(false, `${label} exists`, path.relative(repoRoot, filePath));
    return "";
  }

  record(true, `${label} exists`, path.relative(repoRoot, filePath));
  return fs.readFileSync(filePath, "utf8");
}

function record(ok, label, detail) {
  const prefix = ok ? "OK" : "INVALID";
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`${prefix}: ${label}${suffix}`);
  if (!ok) failures.push(label);
}

function includesAll(label, text, values) {
  for (const value of values) {
    record(text.includes(value), `${label} contains ${value}`);
  }
}

function extractCodeBlock(text, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(
    new RegExp(`### ${escapedHeading}\\n\\n\\\`\\\`\\\`text\\n([\\s\\S]*?)\\n\\\`\\\`\\\``),
  );
  return match?.[1]?.trim() ?? "";
}

function extractPlainSection(text, sectionHeading, languageHeading) {
  const escapedSection = sectionHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedLanguage = languageHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const section = text.match(
    new RegExp(`## ${escapedSection}\\n([\\s\\S]*?)(?:\\n## |$)`),
  )?.[1];
  if (!section) return "";

  return (
    section
      .match(new RegExp(`### ${escapedLanguage}\\n\\n([\\s\\S]*?)(?:\\n### |$)`))?.[1]
      ?.trim() ?? ""
  );
}

function extractPlainBulletList(text, sectionHeading, languageHeading) {
  return extractPlainSection(text, sectionHeading, languageHeading)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function checkLength(label, value, max) {
  record(value.length > 0, `${label} is present`);
  record(value.length <= max, `${label} fits App Store limit`, `${value.length}/${max}`);
}

function checkNoForbiddenDraftWords(label, value) {
  const forbidden = ["TODO", "TBD", "Lorem", "Scaffold", "Preview funktioniert"];
  for (const word of forbidden) {
    record(!value.includes(word), `${label} has no ${word}`);
  }
}

console.log("Store metadata readiness");
console.log("");

for (const [label, filePath] of Object.entries(files)) {
  docs[label] = readDoc(label, filePath);
}

console.log("");
console.log("Canonical App Store Connect values");
console.log("");

for (const [label, value] of [
  ["App name", `App-Name: \`${expected.appName}\``],
  ["Bundle ID", `Bundle ID: \`${expected.bundleId}\``],
  ["SKU", `SKU: \`${expected.sku}\``],
  ["ASC app ID", `App Store Connect App ID: \`${expected.appStoreConnectAppId}\``],
  ["Category", `Kategorie: ${expected.category}`],
  ["Provider", `Anbieter: ${expected.provider}`],
  ["Copyright", `Copyright: \`${expected.copyright}\``],
  ["Support URL", `Support-URL: \`${expected.supportUrl}\``],
  ["Marketing URL", `Marketing-URL: \`${expected.marketingUrl}\``],
  ["Privacy URL", `Datenschutz-URL: \`${expected.privacyUrl}\``],
  ["Impressum URL", `Impressum/Kontakt: \`${expected.impressumUrl}\``],
]) {
  record(docs.fillIn.includes(value), label, value);
}

includesAll("Product identities", docs.productIdentities, [
  expected.bundleId,
  expected.marketingUrl,
  "clearn://auth",
  `${expected.marketingUrl}/auth/confirm`,
]);

console.log("");
console.log("Localized metadata fields");
console.log("");

const fillInSubtitle = extractCodeBlock(docs.fillIn, "Untertitel");
const fillInPromotion = extractCodeBlock(docs.fillIn, "Werbetext");
const fillInDescription = extractCodeBlock(docs.fillIn, "Beschreibung");
const fillInKeywords = extractCodeBlock(docs.fillIn, "Keywords");
const draftSubtitleDe = extractPlainSection(docs.metadata, "Untertitel", "Deutsch");
const draftSubtitleEn = extractPlainSection(docs.metadata, "Untertitel", "Englisch");
const draftPromotionDe = extractPlainSection(docs.metadata, "Promotion Text", "Deutsch");
const screenshotCaptions = extractCodeBlock(docs.fillIn, "Captions")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);
const draftScreenshotCaptions = extractPlainBulletList(
  docs.metadata,
  "Screenshot-Captions",
  "Deutsch",
);

record(fillInSubtitle === expected.subtitleDe, "German subtitle matches release copy");
record(draftSubtitleDe === expected.subtitleDe, "Draft German subtitle matches fill-in pack");
record(draftSubtitleEn === expected.subtitleEn, "Draft English subtitle is present");
record(fillInPromotion === expected.promotionDe, "German promotion text matches release copy");
record(draftPromotionDe === expected.promotionDe, "Draft German promotion text matches fill-in pack");

checkLength("German subtitle", fillInSubtitle, maxLengths.subtitle);
checkLength("German promotion text", fillInPromotion, maxLengths.promotion);
checkLength("German keywords", fillInKeywords, maxLengths.keywords);
checkLength("German description", fillInDescription, maxLengths.description);

record(!/\s/.test(fillInKeywords), "German keywords have no whitespace");
record(fillInKeywords.includes("prüfung"), "German keywords use real umlaut");
record(fillInDescription.includes("fällige Karten"), "German description uses real umlaut");
record(fillInDescription.includes("ohne Konto"), "Description explains guest mode");
record(fillInDescription.includes("Konto erforderlich"), "Description explains account requirement");
record(fillInDescription.includes("Face ID"), "Description mentions Face ID");
record(fillInDescription.includes("PDFs"), "Description mentions PDF scope");
checkNoForbiddenDraftWords("Store fill-in metadata", fillInDescription);

record(screenshotCaptions.length === 5, "Fill-in pack has five screenshot captions");
record(draftScreenshotCaptions.length === 5, "Draft has five German screenshot captions");
for (const caption of screenshotCaptions) {
  record(draftScreenshotCaptions.includes(caption), `Draft includes caption: ${caption}`);
}

console.log("");
console.log("Review notes and product consistency");
console.log("");

includesAll("Fill-in pack", docs.fillIn, expected.productIds);
includesAll("Review notes", docs.reviewNotes, expected.productIds);
includesAll("Review notes", docs.reviewNotes, expected.entitlements);
includesAll("Review notes", docs.reviewNotes, expected.requiredReviewPhrases);
record(docs.reviewNotes.includes("<REVIEW_EMAIL>"), "Review notes keep review email placeholder");
record(docs.reviewNotes.includes("<REVIEW_PASSWORD>"), "Review notes keep review password placeholder");
record(docs.fillIn.includes("<REVIEW_EMAIL>"), "Fill-in pack keeps review email placeholder");
record(docs.fillIn.includes("<REVIEW_PASSWORD>"), "Fill-in pack keeps review password placeholder");

console.log("");
console.log("Screenshot workflow");
console.log("");

includesAll("Screenshot README", docs.screenshots, expected.screenshotIds);
record(docs.screenshots.includes("1242 x 2688"), "Screenshot README documents final size");
record(docs.screenshots.includes("echte Umlaute"), "Screenshot README requires real German umlauts");
record(docs.asoChecklist.includes("Store-Metadata-Entwurf"), "ASO checklist links metadata draft");
record(docs.asoChecklist.includes("App-Store-Connect-Ausfüllpaket"), "ASO checklist links fill-in pack");

console.log("");
if (failures.length === 0) {
  console.log("Store metadata is ready to copy into App Store Connect.");
  process.exit(0);
}

console.log("Store metadata readiness is blocked by:");
for (const failure of failures) {
  console.log(`- ${failure}`);
}

process.exit(1);
