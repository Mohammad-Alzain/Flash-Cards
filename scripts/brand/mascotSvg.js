// Static SVG replica of src/components/illustrations/Mascot.tsx (MascotFigure).
// Keep the geometry in sync with that file — the character must look identical.

const INK = '#1B1B3A';
const CHEEK = '#FF8FB1';
const GOLD = '#FFC24B';

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
};
const lighten = (h, t) => mix(h, '#FFFFFF', t);
const darken = (h, t) => mix(h, '#000000', t);

const spark = (cx, cy, s) =>
  `M ${cx} ${cy - s} Q ${cx} ${cy} ${cx + s} ${cy} Q ${cx} ${cy} ${cx} ${cy + s} Q ${cx} ${cy} ${cx - s} ${cy} Q ${cx} ${cy} ${cx} ${cy - s} Z`;

const eyes = (expr) => {
  const arc = (cx, up) => (up ? `M ${cx - 8} 66 Q ${cx} 56 ${cx + 8} 66` : `M ${cx - 7} 64 Q ${cx} 70 ${cx + 7} 64`);
  const stroke = (w) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" fill="none"`;
  if (expr === 'excited') return `<path d="${arc(42, 1)}" ${stroke(4)}/><path d="${arc(78, 1)}" ${stroke(4)}/>`;
  if (expr === 'sleepy') return `<path d="${arc(42, 0)}" ${stroke(3.5)}/><path d="${arc(78, 0)}" ${stroke(3.5)}/>`;
  const l = expr === 'thinking' ? [3, -4] : [1, 2];
  const eye = (cx, closed) =>
    closed
      ? `<path d="${arc(cx, 1)}" ${stroke(4)}/>`
      : `<ellipse cx="${cx}" cy="64" rx="11" ry="12.5" fill="#FFFFFF" stroke="${INK}" stroke-opacity="0.12" stroke-width="1.5"/>` +
        `<circle cx="${cx + l[0]}" cy="${64 + l[1]}" r="6.5" fill="${INK}"/>` +
        `<circle cx="${cx + l[0] + 2.5}" cy="${64 + l[1] - 2.5}" r="2.4" fill="#FFFFFF"/>`;
  return eye(42, expr === 'wink') + eye(78, false);
};

const mouth = (expr) => {
  if (expr === 'excited') return `<path d="M 47 84 Q 60 104 73 84 Z" fill="${INK}"/><ellipse cx="60" cy="94" rx="6" ry="3.5" fill="${CHEEK}"/>`;
  if (expr === 'sleepy') return `<ellipse cx="60" cy="88" rx="4" ry="4.5" fill="${INK}"/>`;
  return `<path d="M 49 85 Q 60 97 71 85" stroke="${INK}" stroke-width="3.8" stroke-linecap="round" fill="none"/>`;
};

const arms = (pose, c) => {
  const s = `stroke="${c}" stroke-width="8" stroke-linecap="round" fill="none"`;
  const h = (x, y) => `<circle cx="${x}" cy="${y}" r="6" fill="${c}"/>`;
  if (pose === 'wave') return `<path d="M 16 88 Q 4 96 6 108" ${s}/>${h(6, 109)}<path d="M 104 80 Q 118 70 120 52" ${s}/>${h(120, 50)}`;
  if (pose === 'cheer') return `<path d="M 16 80 Q 2 66 2 50" ${s}/>${h(2, 48)}<path d="M 104 80 Q 118 66 118 50" ${s}/>${h(118, 48)}`;
  return `<path d="M 16 88 Q 4 96 6 108" ${s}/>${h(6, 109)}<path d="M 104 88 Q 116 96 114 108" ${s}/>${h(114, 109)}`;
};

/**
 * The mascot in its 120×150 local box.
 * @param {{ uid: string, color?: string, accent?: string, expression?: string, pose?: string, shadow?: boolean }} o
 */
const mascotSvg = ({ uid, color = '#6366F1', accent = '#22D3EE', expression = 'happy', pose = 'idle', shadow = true }) => {
  const limb = darken(color, 0.12);
  return `<g>
  <defs><linearGradient id="body${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lighten(color, 0.22)}"/><stop offset="1" stop-color="${color}"/></linearGradient></defs>
  ${shadow ? '<ellipse cx="60" cy="146" rx="36" ry="5" fill="#000000" opacity="0.1"/>' : ''}
  <g transform="rotate(10 63 70)"><rect x="24" y="10" width="82" height="112" rx="18" fill="${lighten(accent, 0.35)}"/></g>
  ${arms(pose, limb)}
  <ellipse cx="42" cy="140" rx="11" ry="6.5" fill="${limb}"/><ellipse cx="78" cy="140" rx="11" ry="6.5" fill="${limb}"/>
  <g transform="rotate(-4 60 74)">
    <rect x="14" y="14" width="92" height="120" rx="24" fill="url(#body${uid})"/>
    <rect x="22" y="20" width="50" height="10" rx="5" fill="#FFFFFF" opacity="0.22"/>
    <path d="${spark(94, 30, 9)}" fill="${GOLD}"/>
    ${eyes(expression)}
    <ellipse cx="28" cy="82" rx="7.5" ry="4.5" fill="${CHEEK}" opacity="0.7"/><ellipse cx="92" cy="82" rx="7.5" ry="4.5" fill="${CHEEK}" opacity="0.7"/>
    ${mouth(expression)}
  </g>
</g>`;
};

/** Single-colour silhouette (Android monochrome icon / notification icon). Eyes and mouth are cut out. */
const mascotSilhouette = (fill = '#FFFFFF') => `<g>
  <defs><mask id="faceCut"><rect x="-20" y="-20" width="170" height="190" fill="#FFFFFF"/>
    <g transform="rotate(-4 60 74)">
      <ellipse cx="42" cy="64" rx="10" ry="11.5" fill="#000000"/><ellipse cx="78" cy="64" rx="10" ry="11.5" fill="#000000"/>
      <path d="M 49 85 Q 60 97 71 85" stroke="#000000" stroke-width="5" stroke-linecap="round" fill="none"/>
    </g></mask></defs>
  <g mask="url(#faceCut)">
    <g transform="rotate(-4 60 74)"><rect x="14" y="14" width="92" height="120" rx="24" fill="${fill}"/></g>
    <path d="M 16 88 Q 4 96 6 108" stroke="${fill}" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="6" cy="109" r="6.5" fill="${fill}"/>
    <path d="M 104 88 Q 116 96 114 108" stroke="${fill}" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="114" cy="109" r="6.5" fill="${fill}"/>
    <ellipse cx="42" cy="140" rx="11" ry="6.5" fill="${fill}"/><ellipse cx="78" cy="140" rx="11" ry="6.5" fill="${fill}"/>
  </g>
</g>`;

module.exports = { mascotSvg, mascotSilhouette, spark, GOLD, INK, mix, lighten, darken };
