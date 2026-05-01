import { copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileDir = path.resolve(scriptDir, "..");
const assetsDir = path.join(mobileDir, "assets");
const iosIcon = path.join(
  mobileDir,
  "ios/clearnPreview/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png"
);
const iosSplashDir = path.join(
  mobileDir,
  "ios/clearnPreview/Images.xcassets/SplashScreenLegacy.imageset"
);
const brandMarkMaster = path.join(assetsDir, "brand-mark-master.png");
const brandSymbolMaster = path.join(assetsDir, "brand-symbol-master.png");
const brandBackground = "#4F46E5";

const renderMasterPng = async (sourcePng, targetPng, size = 1024) => {
  await sharp(sourcePng)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(targetPng);
};

const renderBrandedIcon = async (targetPng, size = 1024, symbolSize = 820) => {
  const symbol = await sharp(brandSymbolMaster)
    .resize(symbolSize, symbolSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: brandBackground,
    },
  })
    .composite([{ input: symbol, gravity: "center" }])
    .png()
    .toFile(targetPng);
};

const iconPath = path.join(assetsDir, "icon.png");
const brandMarkPath = path.join(assetsDir, "brand-mark.png");
const splashPath = path.join(assetsDir, "splash.png");
const adaptiveIconPath = path.join(assetsDir, "adaptive-icon.png");
const faviconPath = path.join(assetsDir, "favicon.png");

await renderBrandedIcon(iconPath);
await copyFile(iconPath, iosIcon);

await renderMasterPng(brandMarkMaster, brandMarkPath);
await copyFile(brandMarkPath, splashPath);
await copyFile(brandMarkPath, path.join(iosSplashDir, "image.png"));
await copyFile(brandMarkPath, path.join(iosSplashDir, "image@2x.png"));
await copyFile(brandMarkPath, path.join(iosSplashDir, "image@3x.png"));

await renderBrandedIcon(adaptiveIconPath, 1024, 760);

await sharp(iconPath).resize(256, 256).png().toFile(faviconPath);

console.log("Generated app icon assets from brand masters.");
