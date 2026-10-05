// Brand mark: the mascot standing on a night-indigo squircle with synapse sparks.
const { mascotSvg, mascotSilhouette, spark, GOLD } = require('./mascotSvg');

const BG_TOP = '#2E2A7A';
const BG_BOTTOM = '#12112E';
const GLOW = '#6366F1';
const CYAN = '#22D3EE';

/** Mascot placed in a 512×512 canvas. `scale` sets its size; it stays horizontally centred. */
const placedMascot = (scale, centerY, opts = {}) => {
  const tx = 256 - 60 * scale;
  const ty = centerY - 76 * scale;
  return `<g transform="translate(${tx} ${ty}) scale(${scale})">${mascotSvg({ uid: 'm', ...opts })}</g>`;
};

const sparks = () => `
  <path d="${spark(112, 128, 26)}" fill="${GOLD}"/>
  <path d="${spark(404, 398, 16)}" fill="#FFFFFF" opacity="0.85"/>
  <circle cx="414" cy="112" r="11" fill="${CYAN}"/>
  <circle cx="122" cy="404" r="7" fill="#A5F3FC" opacity="0.8"/>`;

const background = (shape) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BG_TOP}"/><stop offset="1" stop-color="${BG_BOTTOM}"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.46" r="0.5"><stop offset="0" stop-color="${GLOW}" stop-opacity="0.55"/><stop offset="1" stop-color="${GLOW}" stop-opacity="0"/></radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.28"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>
  </defs>
  ${shape === 'squircle'
    ? '<rect x="0" y="0" width="512" height="512" rx="124" fill="url(#bg)"/><rect x="3" y="3" width="506" height="506" rx="121" fill="none" stroke="url(#rim)" stroke-width="6"/>'
    : '<rect x="0" y="0" width="512" height="512" fill="url(#bg)"/>'}
  <circle cx="256" cy="236" r="230" fill="url(#glow)"/>`;

/** The logo mark (rounded badge) — used in-app and for store art. */
const markSvg = (size = 512) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  ${background('squircle')}${sparks()}${placedMascot(2.3, 266)}</svg>`;

/** Full-bleed app icon (the OS applies its own mask). */
const appIconSvg = (size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  ${background('square')}${sparks()}${placedMascot(2.3, 266)}</svg>`;

/** Android adaptive foreground: content kept inside the central 66% safe zone. */
const adaptiveForegroundSvg = (size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <path d="${spark(178, 176, 15)}" fill="${GOLD}"/><circle cx="338" cy="170" r="7" fill="${CYAN}"/>
  ${placedMascot(1.62, 262)}</svg>`;

const adaptiveBackgroundSvg = (size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${background('square')}</svg>`;

const monochromeSvg = (size = 1024, scale = 1.62) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <g transform="translate(${256 - 60 * scale} ${262 - 76 * scale}) scale(${scale})">${mascotSilhouette('#FFFFFF')}</g></svg>`;

/** Splash image: the mascot alone on transparency (Android 12+ shows it inside a circle). */
const splashSvg = (size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <path d="${spark(150, 150, 22)}" fill="${GOLD}"/><circle cx="364" cy="146" r="10" fill="${CYAN}"/>
  ${placedMascot(2.2, 262, { shadow: false })}</svg>`;

module.exports = { markSvg, appIconSvg, adaptiveForegroundSvg, adaptiveBackgroundSvg, monochromeSvg, splashSvg, BG_TOP, BG_BOTTOM };
