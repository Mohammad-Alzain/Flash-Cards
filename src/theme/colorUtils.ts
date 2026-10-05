/**
 * Small, dependency-free color helpers used by the design system.
 * All inputs are hex strings (#RGB or #RRGGBB); outputs are hex or rgba strings.
 */

const expandHex = (hex: string): string => {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return h.slice(0, 6);
};

const toRgb = (hex: string): [number, number, number] => {
  const h = expandHex(hex);
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const toHex = (r: number, g: number, b: number): string =>
  '#' +
  [r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

/** Returns the color with the given opacity (0–1) as an rgba() string. */
export const alpha = (hex: string, opacity: number): string => {
  if (!hex.startsWith('#')) return hex;
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, opacity))})`;
};

/** Linear blend between two colors. `amount` 0 → a, 1 → b. */
export const mix = (a: string, b: string, amount: number): string => {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return toHex(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount);
};

export const lighten = (hex: string, amount: number) => mix(hex, '#FFFFFF', amount);
export const darken = (hex: string, amount: number) => mix(hex, '#000000', amount);

/** Relative luminance (WCAG). */
export const luminance = (hex: string): number => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Picks black or white text for the best contrast on the given background. */
export const readableOn = (bg: string): string => (luminance(bg) > 0.45 ? '#0F172A' : '#FFFFFF');
