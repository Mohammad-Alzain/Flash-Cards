// Regenerates every raster brand asset from the SVG sources in ./brand.
// Usage: node scripts/generate-brand-assets.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const L = require('./brand/logoSvg');

const root = path.resolve(__dirname, '..');
const out = (rel) => path.join(root, rel);

const png = (svg, file, size) =>
  sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out(file));

(async () => {
  const jobs = [
    [L.appIconSvg(1024), 'assets/icon.png', 1024],
    [L.adaptiveForegroundSvg(1024), 'assets/adaptive-icon.png', 1024],
    [L.adaptiveBackgroundSvg(1024), 'assets/adaptive-icon-background.png', 1024],
    [L.monochromeSvg(1024), 'assets/adaptive-icon-monochrome.png', 1024],
    [L.monochromeSvg(96, 2.3), 'assets/notification-icon.png', 96],
    [L.splashSvg(1024), 'assets/splash-icon.png', 1024],
    [L.splashSvg(1024), 'assets/splash-icon-dark.png', 1024],
    [L.markSvg(48), 'assets/favicon.png', 48],
    [L.appIconSvg(1024), 'assets/brand/store/app_store_1024.png', 1024],
    [L.markSvg(512), 'assets/brand/store/play_store_512.png', 512],
  ];
  for (const [svg, file, size] of jobs) {
    await png(svg, file, size);
    console.log('✓', file);
  }

  // Keep editable sources next to the rasters.
  const src = (name, svg) => fs.writeFileSync(out(`assets/brand/source/${name}`), svg);
  src('logo_mark.svg', L.markSvg(512));
  src('icon_app.svg', L.appIconSvg(1024));
  src('adaptive_foreground.svg', L.adaptiveForegroundSvg(1024));
  src('adaptive_monochrome.svg', L.monochromeSvg(1024));
  src('notification_icon.svg', L.monochromeSvg(96, 2.3));
  src('splash.svg', L.splashSvg(1024));
  console.log('✓ sources');
})();
