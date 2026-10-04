function normalizeCandidate(filename) {
  if (!filename) return [];
  const clean = filename
    .replace(/^\[sound:/i, '')
    .replace(/\]$/, '')
    .replace(/^['"]/, '')
    .replace(/['"]$/, '')
    .replace(/^\.\//, '')
    .trim();

  const candidates = new Set();
  const unescaped = clean.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  candidates.add(clean);
  candidates.add(unescaped);

  try {
    candidates.add(decodeURIComponent(clean));
    candidates.add(decodeURIComponent(unescaped));
  } catch {}

  try {
    candidates.add(encodeURI(clean));
    candidates.add(encodeURIComponent(clean));
  } catch {}

  const list = Array.from(candidates);
  for (const c of list) {
    candidates.add(c.normalize('NFC'));
    candidates.add(c.normalize('NFD'));
  }

  return Array.from(candidates);
}

const tests = [
  '[sound:rec_01.mp3]',
  '[sound:rec%2001.mp3]',
  'my image.png',
  'my%20image.png',
  'صورة_عربية.jpg',
  'foo&amp;bar.png',
  './sub/pic.jpg',
  '"quoted_file.mp3"',
];

tests.forEach((t) => {
  console.log(`Input: "${t}" -> Candidates:`, normalizeCandidate(t));
});
