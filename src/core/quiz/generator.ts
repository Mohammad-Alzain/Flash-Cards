import { getDatabase } from '../db/connection';
import { QuizConfig, QuizQuestion, QuestionType } from './types';
import { deckRepository } from '../db/repositories/deckRepository';
import { mediaManager } from '../media/mediaManager';

/**
 * Extracts an image filename or URL from a raw field string and resolves it to a full URI
 */
export function extractImageUri(raw: string): string | null {
  if (!raw) return null;
  const str = String(raw).trim();
  const match = str.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && match[1]) {
    return mediaManager.resolveUri(match[1]);
  }
  if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(str)) {
    return mediaManager.resolveUri(str);
  }
  return null;
}

/**
 * Strips HTML, media tags, scripts, and Anki sound tags into clean plain text for quiz UI
 */
export function cleanTextForQuiz(raw: string): string {
  if (!raw) return '';
  let str = String(raw);

  // Preserve image alt text if available, otherwise denote as [صورة]
  str = str.replace(/<img[^>]*alt=["']([^"'>]+)["'][^>]*>/gi, '[$1]');
  str = str.replace(/<img[^>]*>/gi, '[صورة]');

  // Remove Anki sound tags: [sound:filename.mp3]
  str = str.replace(/\[sound:[^\]]+\]/gi, '');

  // Remove script / style tags and content
  str = str.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  str = str.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Replace line breaks and paragraph ends with a single space
  str = str.replace(/<br\s*\/?>/gi, ' ');
  str = str.replace(/<\/p>/gi, ' ');

  // Remove any remaining HTML tags
  str = str.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  str = str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // Normalize whitespace
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Fisher-Yates unbiased array shuffle
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Detects whether a text contains Arabic characters
 */
export function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * Intelligently selects plausible distractors (المشتتات الذكية) matching:
 * 1. Script/Language (Arabic vs Latin/English)
 * 2. Word count similarity
 * 3. Character length proximity
 */
export function selectSmartDistractors(
  correctAnswer: string,
  candidates: string[],
  count = 3
): string[] {
  const isTargetAr = containsArabic(correctAnswer);
  const targetWords = correctAnswer.split(/\s+/).filter(Boolean).length;
  const targetLen = correctAnswer.length;

  // Filter out the exact answer and candidates in different script
  const filtered = candidates.filter((c) => {
    if (!c || c.trim() === correctAnswer.trim()) return false;
    // Must match script: if target has Arabic, distractor must have Arabic; if not, must not
    if (containsArabic(c) !== isTargetAr) return false;
    return true;
  });

  const poolToUse =
    filtered.length >= count
      ? filtered
      : candidates.filter((c) => c && c.trim() !== correctAnswer.trim());

  if (poolToUse.length === 0) return [];

  // Score each candidate by similarity in word count and character length
  const scored = poolToUse.map((c) => {
    const cWords = c.split(/\s+/).filter(Boolean).length;
    const cLen = c.length;
    const wordDiff = Math.abs(cWords - targetWords);
    const lenDiff = Math.abs(cLen - targetLen);
    const score = wordDiff * 8 + lenDiff;
    // Add small random jitter so choices vary between quiz runs
    const jitter = Math.random() * 6;
    return { candidate: c, score: score + jitter };
  });

  scored.sort((a, b) => a.score - b.score);

  const selected = new Set<string>();
  for (const item of scored) {
    selected.add(item.candidate);
    if (selected.size >= count) break;
  }

  return Array.from(selected);
}

/**
 * Evaluates basic template syntax {{Field}}, {{#Field}}...{{/Field}}, {{^Field}}...{{/Field}}
 */
function evaluateSimpleTemplate(template: string, fields: Record<string, string>): string {
  if (!template) return '';
  let result = template;

  // Conditionals
  const posRegex = /\{\{#([^}]+)\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g;
  result = result.replace(posRegex, (_, name, content) => {
    const val = fields[name.trim()] || '';
    return cleanTextForQuiz(val).length > 0 ? content : '';
  });

  const negRegex = /\{\{\^([^}]+)\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g;
  result = result.replace(negRegex, (_, name, content) => {
    const val = fields[name.trim()] || '';
    return cleanTextForQuiz(val).length === 0 ? content : '';
  });

  // Field tags
  const tagRegex = /\{\{([^{}]+)\}\}/g;
  result = result.replace(tagRegex, (_, rawInner) => {
    const inner = rawInner.trim();
    if (inner.toLowerCase() === 'frontside') return '';
    // Handle modifiers like {{text:FieldName}} or {{cloze:FieldName}}
    const parts = inner.split(':');
    const fieldName = parts[parts.length - 1].trim();
    return fields[fieldName] || '';
  });

  return result;
}

export const quizGenerator = {
  /**
   * Retrieves unique field names present in notes for a given deck or globally
   */
  async getAvailableFields(deckId?: string): Promise<string[]> {
    const db = await getDatabase();
    let sql = `
      SELECT n.fields_json 
      FROM notes n
      JOIN cards c ON c.note_id = n.id
    `;
    const params: any[] = [];

    if (deckId) {
      const allDeckIds = await deckRepository.getDeckAndDescendantIds(deckId);
      const placeholders = allDeckIds.map(() => '?').join(',');
      sql += ` WHERE c.deck_id IN (${placeholders})`;
      params.push(...allDeckIds);
    }

    sql += ' LIMIT 40;';
    const rows = await db.getAllAsync<{ fields_json: string }>(sql, ...params).catch(() => []);
    const fieldSet = new Set<string>();

    for (const r of rows) {
      try {
        const obj = JSON.parse(r.fields_json || '{}');
        Object.keys(obj).forEach((k) => {
          if (k.trim().length > 0) fieldSet.add(k.trim());
        });
      } catch {}
    }

    return Array.from(fieldSet);
  },

  /**
   * Generates a list of questions based on QuizConfig with dynamic question/answer fields
   */
  async generateQuestions(config: QuizConfig): Promise<QuizQuestion[]> {
    const db = await getDatabase();

    let sql = `
      SELECT 
        c.id as card_id,
        c.template_ord,
        c.deck_id,
        n.id as note_id,
        n.fields_json,
        n.tags,
        nt.name as note_type_name,
        nt.templates_json,
        nt.is_cloze
      FROM cards c
      JOIN notes n ON n.id = c.note_id
      LEFT JOIN note_types nt ON nt.id = n.note_type_id
      WHERE c.suspended = 0
    `;
    const params: any[] = [];

    // Smart training filters
    if (config.mode === 'mistakes' || config.smartFocus === 'mistakes') {
      sql += ' AND (c.id IN (SELECT card_id FROM mistakes WHERE wrong_count > 0) OR c.lapses > 0)';
    } else if (config.smartFocus === 'due') {
      const nowSec = Math.floor(Date.now() / 1000);
      sql += ` AND ((c.state = 2 AND c.due <= ${nowSec}) OR c.state IN (1, 3))`;
    } else if (config.smartFocus === 'new') {
      sql += ' AND c.state = 0';
    } else if (config.smartFocus === 'hardest') {
      sql += ' AND (c.ease_factor < 2.3 OR c.lapses > 0)';
    }

    if (config.deckId) {
      // Include child decks in the hierarchy (e.g. "Languages::French")
      const allDeckIds = await deckRepository.getDeckAndDescendantIds(config.deckId);
      const placeholders = allDeckIds.map(() => '?').join(',');
      sql += ` AND c.deck_id IN (${placeholders})`;
      params.push(...allDeckIds);
    }

    const requestedLimit = config.questionCount && config.questionCount > 0 ? config.questionCount : 10;
    if (config.smartFocus === 'hardest') {
      sql += ' ORDER BY c.ease_factor ASC, c.lapses DESC LIMIT ?;';
    } else {
      sql += ' ORDER BY RANDOM() LIMIT ?;';
    }
    params.push(Math.max(40, requestedLimit * 4));

    const rows = await db.getAllAsync<any>(sql, ...params);
    if (!rows || rows.length === 0) return [];

    // Parse all cards to { cardId, prompt, answer, promptImage }
    const pool: { cardId: string; prompt: string; answer: string; promptImage?: string }[] = [];

    for (const r of rows) {
      try {
        const fields: Record<string, string> = JSON.parse(r.fields_json || '{}');
        const templateOrd = Number(r.template_ord || 0);
        let prompt = '';
        let answer = '';
        let promptImage: string | undefined;

        // A. Custom dynamic Question and Answer fields selected by user
        if (config.questionField && config.answerField) {
          const rawQ = fields[config.questionField] || '';
          const rawA = fields[config.answerField] || '';
          promptImage = extractImageUri(rawQ) || undefined;
          prompt = cleanTextForQuiz(rawQ);
          answer = cleanTextForQuiz(rawA);

          if (promptImage && (!prompt || prompt === '[صورة]')) {
            prompt = 'صورة';
          }
        }

        // B. Fallback: Cloze Deletion Cards
        if (!prompt || !answer) {
          const isCloze = r.is_cloze === 1 || Object.values(fields).some((v) => /\{\{c\d+::/i.test(v));
          if (isCloze) {
            const targetClozeOrd = templateOrd + 1; // 1-indexed
            const clozeRegex = new RegExp(
              `\\{\\{c${targetClozeOrd}::([\\s\\S]*?)(?:::([\\s\\S]*?))?\\}\\}`,
              'gi'
            );

            for (const val of Object.values(fields)) {
              if (clozeRegex.test(val)) {
                clozeRegex.lastIndex = 0;
                const match = clozeRegex.exec(val);
                if (match) {
                  answer = cleanTextForQuiz(match[1]);
                  const hint = match[2] ? match[2].trim() : '...';
                  let clozePrompt = val.replace(
                    new RegExp(`\\{\\{c${targetClozeOrd}::[\\s\\S]*?\\}\\}`, 'gi'),
                    `[ ${hint} ]`
                  );
                  clozePrompt = clozePrompt.replace(/\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/gi, '$1');
                  prompt = cleanTextForQuiz(clozePrompt);
                  break;
                }
              }
            }
          }
        }

        // C. Fallback: Standard Cards via Note Type Templates
        if (!prompt || !answer) {
          try {
            const rawTemplates = JSON.parse(r.templates_json || '[]');
            const tpl = Array.isArray(rawTemplates)
              ? rawTemplates[templateOrd] || rawTemplates[0]
              : rawTemplates[String(templateOrd)] ||
                rawTemplates[templateOrd] ||
                Object.values(rawTemplates)[0];

            if (tpl && typeof tpl === 'object') {
              const qfmt = tpl.front_html || tpl.qfmt || '';
              const afmt = tpl.back_html || tpl.afmt || '';

              if (qfmt) {
                prompt = cleanTextForQuiz(evaluateSimpleTemplate(qfmt, fields));
              }

              if (afmt) {
                let backTpl = afmt.replace(/\{\{FrontSide\}\}/gi, '');
                if (backTpl.includes('id="answer"') || backTpl.includes('id=answer')) {
                  const parts = backTpl.split(/<hr[^>]*id=["']?answer["']?[^>]*>/i);
                  if (parts.length > 1) {
                    backTpl = parts[1];
                  }
                }
                answer = cleanTextForQuiz(evaluateSimpleTemplate(backTpl, fields));
              }
            }
          } catch (e) {}
        }

        // D. Fallback Heuristics from Field Names & Values
        if (!prompt || !answer) {
          const keys = Object.keys(fields);
          const frontKey = keys.find((k) =>
            /front|question|term|word|expression|headword|text|السؤال|الكلمة|المفردة/i.test(k)
          );
          const backKey = keys.find((k) =>
            /back|answer|meaning|definition|translation|explanation|الجواب|المعنى|الترجمة|الشرح/i.test(k)
          );

          if (frontKey && backKey && frontKey !== backKey) {
            prompt = cleanTextForQuiz(fields[frontKey]);
            answer = cleanTextForQuiz(fields[backKey]);
          } else {
            const cleanEntries = keys
              .map((k) => ({ key: k, text: cleanTextForQuiz(fields[k]) }))
              .filter((e) => e.text.length > 0);

            if (cleanEntries.length >= 2) {
              prompt = cleanEntries[0].text;
              answer = cleanEntries[1].text;
            } else if (cleanEntries.length === 1 && !prompt) {
              prompt = cleanEntries[0].text;
            }
          }
        }

        // Validate prompt and answer
        const hasPrompt = (prompt && prompt.length >= 1) || Boolean(promptImage);
        if (hasPrompt && answer && answer.length >= 1) {
          const finalPrompt = prompt || 'صورة';
          pool.push({ cardId: r.card_id, prompt: finalPrompt, answer, promptImage });
        }
      } catch (e) {}
    }

    if (pool.length === 0) return [];

    // Deduplicate cards in pool by prompt + promptImage
    const uniquePool: { cardId: string; prompt: string; answer: string; promptImage?: string }[] = [];
    const seenPrompts = new Set<string>();
    for (const item of pool) {
      const key = `${item.promptImage || ''}_${item.prompt}`;
      if (!seenPrompts.has(key)) {
        seenPrompts.add(key);
        uniquePool.push(item);
      }
    }

    if (uniquePool.length === 0) return [];

    const isMatchingMode =
      (config.mode === 'matching' ||
        config.mode === 'match' ||
        config.allowedTypes?.includes('matching')) &&
      uniquePool.length >= 2;

    // Matching Mode Question Generator
    if (isMatchingMode) {
      const matchPool = uniquePool.slice(0, Math.min(6, uniquePool.length));
      const pairs = matchPool.map((p, idx) => ({
        id: `pair_${idx}`,
        left: p.prompt,
        right: p.answer,
      }));

      return [
        {
          id: `q_match_${Date.now()}`,
          cardId: matchPool[0]?.cardId || 'card_match',
          type: 'matching',
          prompt: 'Match each term with its definition',
          correctAnswer: 'All matched',
          pairs,
        },
      ];
    }

    // Extra answers pool for distractors when pool is small
    let globalAnswers: string[] = uniquePool.map((p) => p.answer);
    if (globalAnswers.length < 5) {
      try {
        const extraNotes = await db.getAllAsync<{ fields_json: string }>(
          'SELECT fields_json FROM notes ORDER BY RANDOM() LIMIT 20;'
        );
        for (const n of extraNotes) {
          const f = JSON.parse(n.fields_json || '{}');
          for (const v of Object.values<string>(f)) {
            const clean = cleanTextForQuiz(v);
            if (clean.length > 0 && clean.length < 80 && !globalAnswers.includes(clean)) {
              globalAnswers.push(clean);
            }
          }
        }
      } catch (e) {}
    }

    const questions: QuizQuestion[] = [];
    const countToGenerate = Math.min(config.questionCount || 10, uniquePool.length);

    let allowedTypes: QuestionType[] = [];
    if (config.mode === 'written_ai') {
      allowedTypes = ['type_answer'];
    } else if (config.mode === 'mixed') {
      allowedTypes = ['multiple_choice', 'type_answer'];
    } else {
      const rawAllowed = (config.allowedTypes || []).filter(
        (t) => t !== 'matching'
      );
      allowedTypes = rawAllowed.length > 0 ? rawAllowed : ['multiple_choice', 'true_false'];
    }

    // Unbiased shuffle of pool
    const shuffledPool = shuffleArray(uniquePool);

    for (let i = 0; i < countToGenerate; i++) {
      const item = shuffledPool[i];
      let qType: QuestionType = allowedTypes[i % allowedTypes.length];
      const qId = `q_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;

      if (qType === 'type_answer') {
        questions.push({
          id: qId,
          cardId: item.cardId,
          type: 'type_answer',
          prompt: item.prompt,
          promptImage: item.promptImage,
          correctAnswer: item.answer,
        });
        continue;
      }

      // Collect distractors for multiple choice or true/false using smart matching
      const smartDistractors = selectSmartDistractors(item.answer, globalAnswers, 3);

      // Graceful degradation: if no distractors exist, fallback to true_false
      if (qType === 'multiple_choice' && smartDistractors.length === 0) {
        qType = 'true_false';
      }

      if (qType === 'multiple_choice') {
        const allOptions = shuffleArray([item.answer, ...smartDistractors]);

        questions.push({
          id: qId,
          cardId: item.cardId,
          type: 'multiple_choice',
          prompt: item.prompt,
          promptImage: item.promptImage,
          correctAnswer: item.answer,
          options: allOptions,
        });
      } else {
        // true_false
        const isTrue = Math.random() > 0.5;
        let presentedAnswer = item.answer;

        if (!isTrue) {
          const wrongCandidates =
            smartDistractors.length > 0
              ? smartDistractors
              : globalAnswers.filter((a) => a !== item.answer);
          presentedAnswer =
            wrongCandidates.length > 0
              ? wrongCandidates[Math.floor(Math.random() * wrongCandidates.length)]
              : `Not ${item.answer}`;
        }

        questions.push({
          id: qId,
          cardId: item.cardId,
          type: 'true_false',
          prompt: item.prompt,
          promptImage: item.promptImage,
          correctAnswer: isTrue ? 'True' : 'False',
          tfPresentedAnswer: presentedAnswer,
          tfIsCorrect: isTrue,
        });
      }
    }

    return questions;
  },
};
