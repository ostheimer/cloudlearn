import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const canvas = {
  width: 1242,
  height: 2688,
};

const phone = {
  width: 900,
  top: 620,
  radius: 78,
};

const shots = [
  {
    id: "01-home",
    legacySource: "02-home.png",
    title: "Dein Lernstand auf einen Blick",
    subtitle: "Tagesziel, Streak und fällige Karten direkt sichtbar.",
    accent: "#6366f1",
    glow: "#dbe4ff",
  },
  {
    id: "02-scan",
    legacySource: "03-scan.png",
    title: "Aus Fotos werden Karteikarten",
    subtitle: "Erfasse Lernstoff mit Kamera, Galerie oder Text.",
    accent: "#10b981",
    glow: "#d1fae5",
  },
  {
    id: "03-deck",
    legacySource: "09-deck-detail.png",
    title: "KI strukturiert deinen Stoff",
    subtitle: "Prüfe Karten, ordne Decks und lerne gezielt weiter.",
    accent: "#f59e0b",
    glow: "#fef3c7",
  },
  {
    id: "04-learn",
    legacySource: "04-learn-active.png",
    title: "Wiederholen, bis es sitzt",
    subtitle: "Bewerte Karten in kurzen Sessions und bleib im Flow.",
    accent: "#3b82f6",
    glow: "#dbeafe",
  },
  {
    id: "05-profile",
    legacySource: "06-profile.png",
    title: "Konto, Datenschutz und Face ID",
    subtitle: "Verwalte Sicherheit, Support und Einstellungen an einem Ort.",
    accent: "#818cf8",
    glow: "#ede9fe",
  },
];

const args = parseArgs(process.argv.slice(2));
const useLegacyDocScreens = Boolean(args["legacy-doc-screens"]);
const inputDir = path.resolve(
  repoRoot,
  args.input ??
    (useLegacyDocScreens
      ? "docs/screens/screenshots"
      : "docs/screens/app-store/raw/de-DE"),
);
const outputDir = path.resolve(
  repoRoot,
  args.output ?? "docs/screens/app-store/ios/de-DE",
);

if (useLegacyDocScreens) {
  console.warn(
    "Using legacy docs/screens/screenshots input. Use this only for layout drafts, not final App Store uploads.",
  );
}

await fs.mkdir(outputDir, { recursive: true });

const outputs = [];
const missing = [];

for (const shot of shots) {
  const sourceName = useLegacyDocScreens ? shot.legacySource : `${shot.id}.png`;
  const sourcePath = path.join(inputDir, sourceName);

  if (!(await exists(sourcePath))) {
    missing.push(sourcePath);
    continue;
  }

  const outputPath = path.join(outputDir, `${shot.id}.png`);
  await renderShot({ shot, sourcePath, outputPath });
  outputs.push(outputPath);
}

if (missing.length > 0) {
  console.error("Missing raw screenshots:");
  for (const file of missing) {
    console.error(`- ${path.relative(repoRoot, file)}`);
  }
  console.error("\nExpected raw screenshot names:");
  for (const shot of shots) {
    console.error(`- ${shot.id}.png`);
  }
  process.exitCode = 1;
}

if (outputs.length > 0) {
  console.log("Generated App Store screenshots:");
  for (const file of outputs) {
    const metadata = await sharp(file).metadata();
    console.log(
      `- ${path.relative(repoRoot, file)} (${metadata.width}x${metadata.height})`,
    );
  }
}

async function renderShot({ shot, sourcePath, outputPath }) {
  const resized = await sharp(sourcePath)
    .resize({ width: phone.width })
    .png()
    .toBuffer();
  const resizedMeta = await sharp(resized).metadata();
  const rounded = await roundImage(resized, resizedMeta.width, resizedMeta.height);
  const phoneLeft = Math.round((canvas.width - resizedMeta.width) / 2);

  const shadowSvg = Buffer.from(`
    <svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="36" stdDeviation="34" flood-color="#1e1b4b" flood-opacity="0.22"/>
        </filter>
      </defs>
      <rect x="${phoneLeft}" y="${phone.top}" width="${resizedMeta.width}" height="${resizedMeta.height}" rx="${phone.radius}" fill="#ffffff" filter="url(#shadow)"/>
    </svg>
  `);

  const decorationSvg = Buffer.from(`
    <svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="48%" stop-color="${shot.glow}"/>
          <stop offset="100%" stop-color="#eef2ff"/>
        </linearGradient>
        <radialGradient id="orb" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${shot.accent}" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="${shot.accent}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <circle cx="1030" cy="270" r="250" fill="url(#orb)"/>
      <circle cx="120" cy="760" r="210" fill="url(#orb)"/>
      <rect x="86" y="86" width="1070" height="2516" rx="78" fill="#ffffff" opacity="0.38"/>
      <text x="621" y="205" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Helvetica, Arial, sans-serif" font-size="66" font-weight="800" fill="#0f172a">${escapeXml(shot.title)}</text>
      <text x="621" y="280" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', Helvetica, Arial, sans-serif" font-size="34" font-weight="500" fill="#64748b">${escapeXml(shot.subtitle)}</text>
      <rect x="496" y="350" width="250" height="8" rx="4" fill="${shot.accent}"/>
    </svg>
  `);

  await sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: "#f8fafc",
    },
  })
    .composite([
      { input: decorationSvg, top: 0, left: 0 },
      { input: shadowSvg, top: 0, left: 0 },
      { input: rounded, top: phone.top, left: phoneLeft },
    ])
    .png()
    .toFile(outputPath);
}

async function roundImage(input, width, height) {
  const mask = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${phone.radius}" ry="${phone.radius}" fill="#fff"/>
    </svg>
  `);

  return sharp(input)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
