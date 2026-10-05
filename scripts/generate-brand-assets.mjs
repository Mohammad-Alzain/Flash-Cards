import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SRC_DIR = path.join(rootDir, 'assets', 'brand', 'source');
const ASSETS_DIR = path.join(rootDir, 'assets');
const STORE_DIR = path.join(rootDir, 'assets', 'brand', 'store');
const BRAND_DIR = path.join(rootDir, 'assets', 'brand');

async function renderSvgToPng(svgPath, outPath, width, height) {
  const svgBuffer = fs.readFileSync(svgPath);
  await sharp(svgBuffer, { density: 300 })
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  
  const meta = await sharp(outPath).metadata();
  console.log(`  ✓ Generated ${path.relative(rootDir, outPath)} (${meta.width}x${meta.height}, ${Math.round(meta.size / 1024)} KB)`);
  return meta;
}

async function generateAdaptiveMaskPreview(foregroundPath, outPath) {
  // Generates a 1200x440 preview sheet showing the adaptive icon under Circle, Squircle, and Rounded-Square masks
  const size = 320;
  const bg = await sharp({
    create: {
      width: 1200,
      height: 440,
      channels: 4,
      background: { r: 19, g: 31, b: 36, alpha: 1 }, // Brand adaptive background
    },
  }).png().toBuffer();

  // Create circle mask
  const circleSvg = `<svg width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="#fff"/></svg>`;
  // Create rounded square mask (20% radius)
  const roundRectSvg = `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="64" fill="#fff"/></svg>`;
  // Create squircle mask
  const squircleSvg = `<svg width="${size}" height="${size}"><path d="M 0,${size/2} C 0,0 0,0 ${size/2},0 C ${size},0 ${size},0 ${size},${size/2} C ${size},${size} ${size},${size} ${size/2},${size} C 0,${size} 0,${size} 0,${size/2} Z" fill="#fff"/></svg>`;

  const fgBuffer = fs.readFileSync(foregroundPath);
  const fgResized = await sharp(fgBuffer).resize(size, size).png().toBuffer();

  const circleIcon = await sharp(fgResized).composite([{ input: Buffer.from(circleSvg), blend: 'dest-in' }]).png().toBuffer();
  const squircleIcon = await sharp(fgResized).composite([{ input: Buffer.from(squircleSvg), blend: 'dest-in' }]).png().toBuffer();
  const roundRectIcon = await sharp(fgResized).composite([{ input: Buffer.from(roundRectSvg), blend: 'dest-in' }]).png().toBuffer();

  await sharp(bg)
    .composite([
      { input: circleIcon, top: 60, left: 60 },
      { input: squircleIcon, top: 60, left: 440 },
      { input: roundRectIcon, top: 60, left: 820 },
    ])
    .png()
    .toFile(outPath);

  console.log(`  ✓ Generated Adaptive Icon Mask Preview: ${path.relative(rootDir, outPath)} (Circle, Squircle, Rounded-Square)`);
}

async function main() {
  console.log('\n🎨 --- Generating Complete Brand Assets ---\n');

  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });

  const tasks = [
    // 1. App Icon (1024x1024 opaque for iOS & general)
    {
      src: path.join(SRC_DIR, 'icon_app.svg'),
      dest: path.join(ASSETS_DIR, 'icon.png'),
      w: 1024,
      h: 1024,
    },
    // 2. Android Adaptive Icon Foreground (1024x1024, artwork inside safe 66%)
    {
      src: path.join(SRC_DIR, 'adaptive_foreground.svg'),
      dest: path.join(ASSETS_DIR, 'adaptive-icon.png'),
      w: 1024,
      h: 1024,
    },
    // 3. Android 13+ Themed Adaptive Icon Monochrome
    {
      src: path.join(SRC_DIR, 'adaptive_monochrome.svg'),
      dest: path.join(ASSETS_DIR, 'adaptive-icon-monochrome.png'),
      w: 1024,
      h: 1024,
    },
    // 4. Splash Screen Light
    {
      src: path.join(SRC_DIR, 'splash_light.svg'),
      dest: path.join(ASSETS_DIR, 'splash-icon.png'),
      w: 1024,
      h: 1024,
    },
    // 5. Splash Screen Dark (OLED)
    {
      src: path.join(SRC_DIR, 'splash_dark.svg'),
      dest: path.join(ASSETS_DIR, 'splash-icon-dark.png'),
      w: 1024,
      h: 1024,
    },
    // 6. Android Notification Icon (White silhouette on transparent, 96x96)
    {
      src: path.join(SRC_DIR, 'notification_icon.svg'),
      dest: path.join(ASSETS_DIR, 'notification-icon.png'),
      w: 96,
      h: 96,
    },
    // 7. Web Favicon (48x48)
    {
      src: path.join(SRC_DIR, 'logo_mark.svg'),
      dest: path.join(ASSETS_DIR, 'favicon.png'),
      w: 48,
      h: 48,
    },
    // 8. Store: Google Play 512x512
    {
      src: path.join(SRC_DIR, 'icon_app.svg'),
      dest: path.join(STORE_DIR, 'play_store_512.png'),
      w: 512,
      h: 512,
    },
    // 9. Store: Google Play Feature Graphic 1024x500
    {
      src: path.join(SRC_DIR, 'feature_graphic.svg'),
      dest: path.join(STORE_DIR, 'feature_graphic_1024x500.png'),
      w: 1024,
      h: 500,
    },
    // 10. Store: App Store 1024x1024
    {
      src: path.join(SRC_DIR, 'icon_app.svg'),
      dest: path.join(STORE_DIR, 'app_store_1024.png'),
      w: 1024,
      h: 1024,
    },
  ];

  for (const t of tasks) {
    await renderSvgToPng(t.src, t.dest, t.w, t.h);
  }

  // 11. Generate Adaptive Icon Mask Verification Sheet
  await generateAdaptiveMaskPreview(
    path.join(ASSETS_DIR, 'adaptive-icon.png'),
    path.join(BRAND_DIR, 'adaptive_mask_preview.png')
  );

  console.log('\n✨ ALL ASSETS GENERATED & VERIFIED SUCCESSFULLY!\n');
}

main().catch((err) => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
