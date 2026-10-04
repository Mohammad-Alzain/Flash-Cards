import { audioService } from '../audio/audioService';

/**
 * Anki-Compatible Template Engine (Section 8A.4)
 * Pure TypeScript module for rendering card Front and Back templates.
 */

export interface RenderCardOptions {
  frontTemplate: string;
  backTemplate: string;
  fields: Record<string, string>; // fieldName -> value
  css?: string;
  templateOrd?: number; // 0-indexed (card1, card2)
  templateName?: string;
  noteTypeName?: string;
  deckName?: string;
  tags?: string;
  flag?: number;
  isNightMode?: boolean;
  userInput?: string; // For {{type:Field}} evaluation on back
  mediaBaseUri?: string; // e.g. file:///data/.../media/
}

export interface RenderedCard {
  frontHtml: string;
  backHtml: string;
  fullFrontPage: string;
  fullBackPage: string;
  hasEmptyFront: boolean;
  clozeNumbers: number[];
  frontAudio: string[];
  backAudio: string[];
}

/**
 * Strips HTML tags from string to test for emptiness or text: modifier
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Checks if a field has meaningful content (not empty, not just <br> or whitespace)
 */
export function isFieldNonEmpty(val: string | undefined): boolean {
  if (!val) return false;
  // If it contains media elements or sound tags, it is definitely non-empty
  if (/<(img|audio|video|iframe|svg|object|embed)\b/i.test(val) || /\[sound:[^\]]+\]/i.test(val)) {
    return true;
  }
  // Remove empty HTML tags and whitespace
  const stripped = val
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
  return stripped.length > 0;
}

/**
 * Extracts cloze indices from text (e.g. {{c1::...}}, {{c2::...}})
 */
export function extractClozeIndices(text: string): number[] {
  const indices = new Set<number>();
  const regex = /\{\{c(\d+)::[\s\S]*?\}\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    indices.add(parseInt(match[1], 10));
  }
  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Renders cloze text for a given ordinal (1-indexed)
 */
export function renderCloze(
  text: string,
  targetClozeOrd: number,
  isBack: boolean
): string {
  const regex = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

  return text.replace(regex, (match, numStr, answer, hint) => {
    const num = parseInt(numStr, 10);
    if (num === targetClozeOrd) {
      if (!isBack) {
        // Front: show [...] or [hint]
        const hintText = hint ? hint.trim() : '...';
        return `<span class="cloze">[${hintText}]</span>`;
      } else {
        // Back: show answer highlighted
        return `<span class="cloze">${answer}</span>`;
      }
    } else {
      // Non-target clozes always display the answer
      return answer;
    }
  });
}

/**
 * Renders Furigana: converts "漢字[かんじ]" to "<ruby><rb>漢字</rb><rt>かんじ</rt></ruby>"
 */
export function renderFurigana(text: string): string {
  if (!text) return '';
  return text.replace(/ ?([^ >~[\]]+)\[([^\]]+)\]/g, '<ruby><rb>$1</rb><rt>$2</rt></ruby>');
}

/**
 * Strips furigana annotations to leave only kanji: "漢字[かんじ]" -> "漢字"
 */
export function renderKanji(text: string): string {
  if (!text) return '';
  return text.replace(/ ?([^ >~[\]]+)\[([^\]]+)\]/g, '$1');
}

/**
 * Strips kanji to leave only reading inside brackets: "漢字[かんじ]" -> "かんじ"
 */
export function renderKana(text: string): string {
  if (!text) return '';
  return text.replace(/ ?([^ >~[\]]+)\[([^\]]+)\]/g, '$2');
}

/**
 * Case-insensitive field lookup helper
 */
export function getFieldValue(fields: Record<string, string>, fieldName: string): string {
  if (!fields) return '';
  if (fields[fieldName] !== undefined) return fields[fieldName];
  const target = fieldName.trim().toLowerCase();
  for (const [k, v] of Object.entries(fields)) {
    if (k.trim().toLowerCase() === target) return v;
  }
  return '';
}

/**
 * Resolves media paths: <img>, <video>, <audio>, <source> with relative paths -> full URI
 * and [sound:file.mp3] -> discrete audio replay button matching Anki
 * and [sound:video.mp4] -> HTML5 <video> player matching Anki
 */
export function resolveMediaTags(html: string, mediaBaseUri = ''): string {
  let result = html;
  const fixedBase = mediaBaseUri ? (mediaBaseUri.endsWith('/') ? mediaBaseUri : mediaBaseUri + '/') : '';

  // 1. Resolve relative src in <img>, <video>, <audio>, <source>, <track> tags
  result = result.replace(
    /<(img|video|audio|source|track)(\s[^>]*?)src=(?:["']([^"']+)["']|([^\s>]+))([^>]*)>/gi,
    (match, tag, before, qSrc, unqSrc, after) => {
      const rawSrc = (qSrc || unqSrc || '').trim();
      if (!rawSrc) return match;
      if (
        rawSrc.startsWith('http://') ||
        rawSrc.startsWith('https://') ||
        rawSrc.startsWith('data:') ||
        rawSrc.startsWith('file://')
      ) {
        return match;
      }
      const cleanSrc = rawSrc.replace(/^\.\//, '');
      const fullSrc = fixedBase ? `${fixedBase}${cleanSrc}` : cleanSrc;
      let safeSrc = fullSrc;
      if (safeSrc.startsWith('file://')) {
        try {
          safeSrc = encodeURI(decodeURI(safeSrc)).replace(/#/g, '%23');
        } catch {}
      }
      return `<${tag}${before}src="${safeSrc}"${after}>`;
    }
  );

  // 2. Resolve [sound:filename] tags:
  // - If it's a video file (.mp4, .webm, etc.), render HTML5 video element
  // - If it's audio (.mp3, etc.), render discrete interactive button matching Anki
  result = result.replace(/\[sound:([^\]]+)\]/g, (match, filename) => {
    const trimmed = filename.trim();
    const isVideo = /\.(mp4|webm|mkv|mov|m4v|avi|ogv)$/i.test(trimmed);
    if (isVideo) {
      const rawVideoSrc = trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('file://')
        ? trimmed
        : `${fixedBase}${trimmed}`;
      let videoSrc = rawVideoSrc;
      if (videoSrc.startsWith('file://')) {
        try {
          videoSrc = encodeURI(decodeURI(videoSrc)).replace(/#/g, '%23');
        } catch {}
      }
      return `<div style="text-align:center; margin:8px 0;"><video controls playsinline preload="metadata" style="max-width:100%; max-height:260px; border-radius:8px;"><source src="${videoSrc}">Your device does not support video playback.</video></div>`;
    }

    return `<button class="sound-button replay-button" type="button" aria-label="Audio" onclick="event.stopPropagation(); event.preventDefault(); if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify({type:'sound', file:'${trimmed}'})); }"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:middle;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg></button>`;
  });

  return result;
}

/**
 * Evaluates conditionals: {{#Field}}...{{/Field}} and {{^Field}}...{{/Field}}
 * Loops to handle nested conditionals up to 5 levels deep.
 */
function evaluateConditionals(
  template: string = '',
  fields: Record<string, string> = {}
): string {
  let result = template || '';
  if (!result || typeof result !== 'string') return '';

  const safeFields = fields || {};
  let previous = '';
  let loopCount = 0;

  while (previous !== result && loopCount < 5) {
    previous = result;
    loopCount++;

    // 1. Positive conditionals: {{#FieldName}}...{{/FieldName}}
    const posRegex = /\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g;
    result = result.replace(posRegex, (match, rawFieldName, content) => {
      const val = getFieldValue(safeFields, rawFieldName.trim());
      return isFieldNonEmpty(val) ? content : '';
    });

    // 2. Inverted conditionals: {{^FieldName}}...{{/FieldName}}
    const negRegex = /\{\{\^([^}]+)\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g;
    result = result.replace(negRegex, (match, rawFieldName, content) => {
      const val = getFieldValue(safeFields, rawFieldName.trim());
      return !isFieldNonEmpty(val) ? content : '';
    });
  }

  return result;
}

/**
 * Replaces tags {{Field}}, {{text:Field}}, {{hint:Field}}, {{cloze:Field}}, {{furigana:Field}}, {{type:Field}}, and specials
 */
function replaceFieldTags(
  template: string,
  fields: Record<string, string>,
  specialFields: Record<string, string>,
  clozeOrd: number,
  isBack: boolean,
  userInput?: string
): string {
  const tagRegex = /\{\{([^{}]+)\}\}/g;

  return template.replace(tagRegex, (fullMatch, rawInner) => {
    const inner = rawInner.trim();

    // Skip conditionals or FrontSide placeholder if present
    if (inner.startsWith('#') || inner.startsWith('^') || inner.startsWith('/') || inner.toLowerCase() === 'frontside') {
      return fullMatch;
    }

    // 1. Direct match in specialFields
    for (const [k, v] of Object.entries(specialFields)) {
      if (k.toLowerCase() === inner.toLowerCase()) {
        return v;
      }
    }

    // 2. Direct match in note fields
    const directVal = getFieldValue(fields, inner);
    if (directVal !== undefined && directVal !== '') {
      return directVal;
    }

    // 3. Split modifiers e.g. {{furigana:text:FieldName}} or {{tts en_US:Field}}
    const parts = inner.split(':');
    if (parts.length === 1) {
      return directVal || '';
    }

    const fieldName = parts[parts.length - 1].trim();
    const modifiers = parts.slice(0, -1).map((m: string) => m.trim());

    let val = getFieldValue(fields, fieldName);

    // Apply modifiers from right to left
    for (let i = modifiers.length - 1; i >= 0; i--) {
      const mod = modifiers[i];
      const modLower = mod.toLowerCase();

      if (modLower === 'text') {
        val = stripHtml(val);
      } else if (modLower === 'furigana') {
        val = renderFurigana(val);
      } else if (modLower === 'kanji') {
        val = renderKanji(val);
      } else if (modLower === 'kana') {
        val = renderKana(val);
      } else if (modLower.startsWith('tts')) {
        val = stripHtml(val);
      } else if (modLower === 'cloze' || modLower === 'cq' || modLower === 'ca') {
        val = renderCloze(val, clozeOrd, isBack);
      } else if (modLower === 'hint') {
        if (isFieldNonEmpty(val)) {
          const hintId = `hint_${Math.random().toString(36).substr(2, 7)}`;
          val = `
            <a class="hint" href="#" id="link_${hintId}" onclick="document.getElementById('${hintId}').style.display='block';this.style.display='none';return false;">
              Show ${fieldName}
            </a>
            <div id="${hintId}" class="hint-content" style="display:none;">${val}</div>
          `;
        } else {
          val = '';
        }
      } else if (modLower === 'type') {
        if (!isBack) {
          val = `<div class="type-container"><input class="type-input" id="typeans" type="text" placeholder="Type answer..." /></div>`;
        } else {
          const expected = stripHtml(val);
          const typed = userInput !== undefined ? userInput.trim() : '';
          const isMatch = typed.toLowerCase() === expected.toLowerCase();
          val = `
            <div class="type-result ${isMatch ? 'type-correct' : 'type-incorrect'}">
              <span class="type-typed">${typed || '<em>(empty)</em>'}</span>
              ${!isMatch ? `<div class="type-expected">Expected: <strong>${expected}</strong></div>` : ''}
            </div>
          `;
        }
      }
    }

    return val;
  });
}

/**
 * Builds the full HTML document with CSS, classes, and viewport settings for WebView matching Anki
 */
export function buildHtmlDocument(
  bodyContent: string,
  css = '',
  cardOrd = 0,
  isNightMode = false,
  mediaBaseUri = ''
): string {
  const cardClass = `card card${cardOrd + 1} ${isNightMode ? 'nightMode night_mode' : ''} android mobile`;

  // Extract CSS @import statements to place them at the very top of <style>
  const importRegex = /@import[^;]+;/gi;
  const importsList = css.match(importRegex) || [];
  const imports = importsList.join('\n');
  const cleanCss = css.replace(importRegex, '');

  // Automatically resolve relative url(...) in custom CSS to local mediaBaseUri (for @font-face & images)
  let processedCss = cleanCss;
  if (mediaBaseUri) {
    const fixedBase = mediaBaseUri.endsWith('/') ? mediaBaseUri : mediaBaseUri + '/';
    processedCss = processedCss.replace(
      /url\(\s*(['"]?)(?!https?:\/\/|data:|file:\/\/)([^'")]+)\1\s*\)/gi,
      (match, quote, relPath) => {
        return `url(${quote}${fixedBase}${relPath.trim()}${quote})`;
      }
    );
  }

  const baseTag = mediaBaseUri
    ? `<base href="${mediaBaseUri.endsWith('/') ? mediaBaseUri : mediaBaseUri + '/'}">`
    : '';

  return `<!DOCTYPE html>
<html class="${isNightMode ? 'nightMode night_mode' : ''} android mobile">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  ${baseTag}
  <style>
    ${imports}

    html {
      height: 100%;
    }
    body {
      margin: 0;
      padding: 16px 16px 40px 16px;
      min-height: 100%;
      box-sizing: border-box;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", "Nunito", Arial, sans-serif;
      word-break: break-word;
      overflow-wrap: break-word;
      unicode-bidi: plaintext;
    }
    /* Default Anki base styling (overridden by note CSS) */
    .card {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", "Nunito", Arial, sans-serif;
      font-size: 20px;
      line-height: 1.5;
      text-align: center;
      color: #111111;
      background-color: #ffffff;
    }
    .nightMode.card, .night_mode.card, .nightMode .card, .night_mode .card {
      color: #f1f1f1;
      background-color: #23272a;
    }
    .cloze {
      font-weight: bold;
      color: #1CB0F6;
    }
    .nightMode .cloze, .night_mode .cloze {
      color: #58CC02;
    }
    #answer {
      border: none;
      border-top: 1px solid ${isNightMode ? '#37464F' : '#E5E5E5'};
      margin: 16px 0;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      vertical-align: middle;
    }
    /* Discrete inline Anki sound buttons */
    .sound-button, .replay-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background-color: rgba(28, 176, 246, 0.15);
      border: 1px solid rgba(28, 176, 246, 0.4);
      color: #1CB0F6;
      cursor: pointer;
      margin: 2px 4px;
      padding: 0;
      transition: all 0.15s ease;
    }
    .nightMode .sound-button, .night_mode .sound-button,
    .nightMode .replay-button, .night_mode .replay-button {
      background-color: rgba(88, 204, 2, 0.15);
      border-color: rgba(88, 204, 2, 0.4);
      color: #58CC02;
    }
    .sound-button:active, .replay-button:active {
      transform: scale(0.92);
      background-color: rgba(28, 176, 246, 0.3);
    }
    .hint {
      color: #1CB0F6;
      text-decoration: underline;
      cursor: pointer;
      font-size: 14px;
    }
    .hint-content {
      margin-top: 6px;
      font-style: italic;
    }
    .type-container {
      margin: 16px 0;
    }
    .type-input {
      font-size: 18px;
      padding: 10px 14px;
      border-radius: 10px;
      border: 2px solid #E5E5E5;
      width: 80%;
      text-align: center;
      background: ${isNightMode ? '#1F2C34' : '#FFFFFF'};
      color: ${isNightMode ? '#F1F7FB' : '#333333'};
    }
    .type-result {
      padding: 10px;
      border-radius: 8px;
      margin: 12px 0;
    }
    .type-correct {
      background: #E5F8D0;
      color: #46A302;
    }
    .type-incorrect {
      background: #FFE5E5;
      color: #EA2B2B;
    }
    ruby rt {
      font-size: 0.6em;
      color: inherit;
    }
    /* Note Type CSS from Anki */
    ${processedCss}
  </style>
</head>
<body class="${cardClass}">
  <div class="card-inner">
    ${bodyContent}
  </div>
  <script>
    (function() {
      var startX = 0;
      var startY = 0;
      var startTime = 0;
      var moved = false;

      document.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1) {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
          startTime = Date.now();
          moved = false;
        }
      }, { passive: true });

      document.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1) {
          var dx = Math.abs(e.touches[0].clientX - startX);
          var dy = Math.abs(e.touches[0].clientY - startY);
          if (dx > 10 || dy > 10) {
            moved = true;
          }
        }
      }, { passive: true });

      document.addEventListener('touchend', function(e) {
        var elapsed = Date.now() - startTime;
        if (!moved && elapsed < 350) {
          var target = e.target;
          while (target && target !== document.body) {
            var tag = target.tagName ? target.tagName.toLowerCase() : '';
            if (tag === 'button' || tag === 'input' || tag === 'a' || tag === 'textarea' || tag === 'select' || (target.classList && (target.classList.contains('sound-button') || target.classList.contains('replay-button')))) {
              return;
            }
            target = target.parentElement;
          }
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'flip' }));
          }
        }
      }, { passive: true });
    })();
  </script>
</body>
</html>`;
}

/**
 * Main render function: takes front and back templates + fields and produces rendered HTML
 */
export function renderCard(options: RenderCardOptions): RenderedCard {
  const {
    frontTemplate,
    backTemplate,
    fields,
    css = '',
    templateOrd = 0,
    templateName = 'Card 1',
    noteTypeName = 'Basic',
    deckName = 'Default',
    tags = '',
    flag = 0,
    isNightMode = false,
    userInput,
    mediaBaseUri = '',
  } = options;

  // Cloze detection (1-indexed)
  const clozeOrd = templateOrd + 1;

  // Build special fields
  const subdeck = deckName.includes('::') ? deckName.split('::').pop() || deckName : deckName;
  const specialFields: Record<string, string> = {
    Tags: tags,
    Deck: deckName,
    Subdeck: subdeck,
    Card: templateName,
    Type: noteTypeName,
    CardFlag: flag > 0 ? String(flag) : '',
  };

  const safeFields = fields || {};
  const fieldKeys = Object.keys(safeFields);

  let safeFrontTemplate = frontTemplate || '';
  let safeBackTemplate = backTemplate || '';

  // Smart recovery if template references {{Front}} but Front is NOT in note fields
  const hasFrontField = fieldKeys.some((k) => k.toLowerCase() === 'front');
  if (!hasFrontField && safeFrontTemplate.includes('{{Front}}') && fieldKeys.length > 0) {
    safeFrontTemplate = `{{${fieldKeys[0]}}}`;
    safeBackTemplate = `{{FrontSide}}<hr id="answer">{{${fieldKeys[1] || fieldKeys[0]}}}`;
    for (let i = 2; i < fieldKeys.length; i++) {
      safeBackTemplate += `<br>{{${fieldKeys[i]}}}`;
    }
  }

  if (!safeFrontTemplate) {
    safeFrontTemplate = fieldKeys[0] ? `{{${fieldKeys[0]}}}` : '{{Front}}';
  }
  if (!safeBackTemplate) {
    safeBackTemplate = fieldKeys[1]
      ? `{{FrontSide}}<hr id="answer">{{${fieldKeys[1]}}}`
      : `{{FrontSide}}<hr id="answer">{{${fieldKeys[0] || 'Back'}}}`;
  }

  // 1. Process Front
  let frontProcessed = evaluateConditionals(safeFrontTemplate, safeFields);
  frontProcessed = replaceFieldTags(
    frontProcessed,
    safeFields,
    specialFields,
    clozeOrd,
    false
  );
  const frontAudio = audioService.extractSoundTags(frontProcessed);
  frontProcessed = resolveMediaTags(frontProcessed, mediaBaseUri);

  const hasEmptyFront = stripHtml(frontProcessed).length === 0;

  // 2. Process Back
  // Extract back-specific audio (excluding audio inherited from {{FrontSide}})
  let backOnly = (safeBackTemplate || '').replace(/\{\{FrontSide\}\}/gi, '');
  backOnly = evaluateConditionals(backOnly, safeFields);
  backOnly = replaceFieldTags(
    backOnly,
    safeFields,
    specialFields,
    clozeOrd,
    true,
    userInput
  );
  const backAudio = audioService.extractSoundTags(backOnly);

  // Render back template replacing {{FrontSide}} with the already-rendered front
  let backWithFrontSide = (safeBackTemplate || '');
  let backProcessed = evaluateConditionals(backWithFrontSide, safeFields);
  backProcessed = replaceFieldTags(
    backProcessed,
    safeFields,
    specialFields,
    clozeOrd,
    true,
    userInput
  );
  backProcessed = backProcessed.replace(/\{\{FrontSide\}\}/gi, frontProcessed);
  backProcessed = resolveMediaTags(backProcessed, mediaBaseUri);

  // Detect all cloze numbers in all fields
  const allFieldValues = Object.values(fields).join(' ');
  const clozeNumbers = extractClozeIndices(allFieldValues);

  return {
    frontHtml: frontProcessed,
    backHtml: backProcessed,
    fullFrontPage: buildHtmlDocument(frontProcessed, css, templateOrd, isNightMode, mediaBaseUri),
    fullBackPage: buildHtmlDocument(backProcessed, css, templateOrd, isNightMode, mediaBaseUri),
    hasEmptyFront,
    clozeNumbers,
    frontAudio,
    backAudio,
  };
}
