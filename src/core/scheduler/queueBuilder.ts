import { getDatabase } from '../db/connection';
import { Card, CardState, ReviewLog } from '../types/models';
import { deckRepository } from '../db/repositories/deckRepository';
import {
  Rating,
  SchedulerOptions,
  DEFAULT_SCHEDULER_OPTIONS,
  SchedulingResult,
} from './types';
import { calculateSM2NextReview } from './sm2';
import { calculateFSRSNextReview } from './fsrs';
import {
  getDayEndTimestamp,
  getDateStringForRollover,
  getRolloverDate,
} from './dayBoundary';

export interface StudyCardItem extends Card {
  note_fields: Record<string, string>;
  tags: string;
  note_type_name: string;
  front_template: string;
  back_template: string;
  css: string;
  deck_name: string;
}

export const queueBuilder = {
  /**
   * Fetches review queue (due cards + learning cards) respecting daily limits and rollover
   */
  async buildReviewQueue(
    deckId?: string,
    options: SchedulerOptions = DEFAULT_SCHEDULER_OPTIONS,
    mode: 'due' | 'all' | 'studied' | 'selected' = 'due',
    specificCardIds?: string[]
  ): Promise<StudyCardItem[]> {
    const db = await getDatabase();
    const now = Date.now();
    const dayEnd = getDayEndTimestamp(now, options.rolloverHour);

    let sql = `
      SELECT 
        c.*,
        n.fields_json as raw_fields,
        n.tags as tags,
        nt.name as note_type_name,
        nt.templates_json as raw_templates,
        nt.css as css,
        d.name as deck_name
      FROM cards c
      JOIN notes n ON n.id = c.note_id
      JOIN note_types nt ON nt.id = n.note_type_id
      JOIN decks d ON d.id = c.deck_id
      WHERE c.suspended = 0
    `;
    const params: any[] = [];

    let deckFilterClause = '';
    const deckParams: string[] = [];
    if (deckId) {
      const allDeckIds = await deckRepository.getDeckAndDescendantIds(deckId);
      const placeholders = allDeckIds.map(() => '?').join(',');
      deckFilterClause = ` AND c.deck_id IN (${placeholders})`;
      deckParams.push(...allDeckIds);
    }

    let reviewLimit = 100;
    if (deckId) {
      const deck = await deckRepository.getById(deckId);
      if (deck && deck.reviews_per_day) {
        reviewLimit = deck.reviews_per_day;
      }
    }

    if (mode === 'selected' && specificCardIds && specificCardIds.length > 0) {
      const placeholders = specificCardIds.map(() => '?').join(',');
      sql += ` AND c.id IN (${placeholders})`;
      params.push(...specificCardIds);
    } else if (mode === 'studied') {
      sql += ` AND (c.state != 0 OR c.reps > 0)`;
      if (deckFilterClause) {
        sql += deckFilterClause;
        params.push(...deckParams);
      }
    } else if (mode === 'all') {
      if (deckFilterClause) {
        sql += deckFilterClause;
        params.push(...deckParams);
      }
    } else {
      // Standard 'due' mode: strictly cards that have matured for review now
      sql += `
        AND (c.buried_until IS NULL OR c.buried_until <= ?)
        AND (
          (c.state = 2 AND c.due <= ?) OR 
          ((c.state = 1 OR c.state = 3) AND (c.due IS NULL OR c.due <= ?))
        )
      `;
      params.push(now, now, now);
      if (deckFilterClause) {
        sql += deckFilterClause;
        params.push(...deckParams);
      }
    }

    sql += ' ORDER BY c.due ASC, c.template_ord ASC LIMIT ?;';
    params.push(reviewLimit);

    const rows = await db.getAllAsync<any>(sql, ...params);

    // Filter siblings (only show 1 card per note in a single batch)
    const seenNoteIds = new Set<string>();
    const result: StudyCardItem[] = [];

    for (const r of rows) {
      if (seenNoteIds.has(r.note_id)) {
        continue; // Sibling burying within session
      }
      seenNoteIds.add(r.note_id);

      let fields: Record<string, string> = {};
      try {
        fields = JSON.parse(r.raw_fields || '{}');
      } catch (e) {}

      let frontTpl = '{{Front}}';
      let backTpl = '{{Back}}';
      try {
        const rawTpls = JSON.parse(r.raw_templates || '[]');
        const tpl = Array.isArray(rawTpls)
          ? rawTpls[r.template_ord] || rawTpls[0]
          : rawTpls[String(r.template_ord)] || rawTpls[r.template_ord] || Object.values(rawTpls)[0];
        if (tpl && typeof tpl === 'object') {
          frontTpl = (tpl as any).front_html || (tpl as any).qfmt || '{{Front}}';
          backTpl = (tpl as any).back_html || (tpl as any).afmt || '{{Back}}';
        }
      } catch (e) {}

      // Strip legacy artificial wrappers if present
      frontTpl = frontTpl
        .replace(/<div class="card front">/gi, '')
        .replace(/<div class="card back">/gi, '')
        .replace(/<\/div>$/gi, '')
        .trim();

      backTpl = backTpl
        .replace(/<div class="card front">/gi, '')
        .replace(/<div class="card back">/gi, '')
        .replace(/<\/div>$/gi, '')
        .trim();

      result.push({
        ...r,
        note_fields: fields,
        front_template: frontTpl,
        back_template: backTpl,
        css: r.css || '',
        deck_name: r.deck_name,
      });
    }

    return result;
  },

  /**
   * Fetches new cards queue for Learn New mode
   */
  async buildLearnQueue(
    deckId?: string,
    limit = 20,
    options: SchedulerOptions = DEFAULT_SCHEDULER_OPTIONS
  ): Promise<StudyCardItem[]> {
    const db = await getDatabase();
    const now = Date.now();

    let sql = `
      SELECT 
        c.*,
        n.fields_json as raw_fields,
        n.tags as tags,
        nt.name as note_type_name,
        nt.templates_json as raw_templates,
        nt.css as css,
        d.name as deck_name
      FROM cards c
      JOIN notes n ON n.id = c.note_id
      JOIN note_types nt ON nt.id = n.note_type_id
      JOIN decks d ON d.id = c.deck_id
      WHERE c.suspended = 0 
        AND c.state = 0
        AND (c.buried_until IS NULL OR c.buried_until <= ?)
    `;
    const params: any[] = [now];

    if (deckId) {
      const allDeckIds = await deckRepository.getDeckAndDescendantIds(deckId);
      const placeholders = allDeckIds.map(() => '?').join(',');
      sql += ` AND c.deck_id IN (${placeholders})`;
      params.push(...allDeckIds);
    }

    sql += ' ORDER BY c.created_at ASC, c.template_ord ASC LIMIT ?;';
    params.push(limit);

    const rows = await db.getAllAsync<any>(sql, ...params);
    const result: StudyCardItem[] = [];

    for (const r of rows) {
      let fields: Record<string, string> = {};
      try {
        fields = JSON.parse(r.raw_fields || '{}');
      } catch (e) {}

      let frontTpl = '{{Front}}';
      let backTpl = '{{Back}}';
      try {
        const rawTpls = JSON.parse(r.raw_templates || '[]');
        const tpl = Array.isArray(rawTpls)
          ? rawTpls[r.template_ord] || rawTpls[0]
          : rawTpls[String(r.template_ord)] || rawTpls[r.template_ord] || Object.values(rawTpls)[0];
        if (tpl && typeof tpl === 'object') {
          frontTpl = (tpl as any).front_html || (tpl as any).qfmt || '{{Front}}';
          backTpl = (tpl as any).back_html || (tpl as any).afmt || '{{Back}}';
        }
      } catch (e) {}

      // Strip legacy artificial wrappers if present
      frontTpl = frontTpl
        .replace(/<div class="card front">/gi, '')
        .replace(/<div class="card back">/gi, '')
        .replace(/<\/div>$/gi, '')
        .trim();

      backTpl = backTpl
        .replace(/<div class="card front">/gi, '')
        .replace(/<div class="card back">/gi, '')
        .replace(/<\/div>$/gi, '')
        .trim();

      result.push({
        ...r,
        note_fields: fields,
        front_template: frontTpl,
        back_template: backTpl,
        css: r.css || '',
        deck_name: r.deck_name,
      });
    }

    return result;
  },

  /**
   * Returns count of non-suspended cards that have been studied previously (state != 0 or reps > 0)
   */
  async getStudiedCardsCount(deckId?: string): Promise<number> {
    const db = await getDatabase();
    let sql = 'SELECT COUNT(*) as count FROM cards WHERE suspended = 0 AND (state != 0 OR reps > 0)';
    const params: any[] = [];
    if (deckId) {
      const allDeckIds = await deckRepository.getDeckAndDescendantIds(deckId);
      const placeholders = allDeckIds.map(() => '?').join(',');
      sql += ` AND deck_id IN (${placeholders})`;
      params.push(...allDeckIds);
    }
    const row = await db.getFirstAsync<{ count: number }>(sql, ...params);
    return row?.count || 0;
  },

  /**
   * Applies answer rating to a card, updates SQLite, logs review, and increments daily stats & XP
   */
  async answerCard(
    card: Card,
    rating: Rating,
    durationMs = 5000,
    options: SchedulerOptions = DEFAULT_SCHEDULER_OPTIONS
  ): Promise<SchedulingResult> {
    const db = await getDatabase();
    const now = Date.now();

    // 1. Calculate next review
    const next =
      options.algorithm === 'fsrs'
        ? calculateFSRSNextReview(card, rating, options, now)
        : calculateSM2NextReview(card, rating, options, now);

    // 2. Create review log
    const logId = `rev_${now}_${Math.random().toString(36).substring(2, 6)}`;
    await db.runAsync(
      `INSERT INTO review_logs (
         id, card_id, deck_id, rating, state_before, due_before,
         interval_before, interval_after, duration_ms, reviewed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      logId,
      card.id,
      card.deck_id,
      rating,
      card.state,
      card.due,
      card.interval_days,
      next.intervalDays,
      durationMs,
      now
    );

    // 3. Update card state in SQLite
    await db.runAsync(
      `UPDATE cards SET
         state = ?,
         due = ?,
         stability = ?,
         difficulty = ?,
         reps = ?,
         lapses = ?,
         ease_factor = ?,
         interval_days = ?,
         last_review = ?,
         updated_at = ?
       WHERE id = ?;`,
      next.cardState,
      next.due,
      next.stability,
      next.difficulty,
      next.reps,
      next.lapses,
      next.easeFactor,
      next.intervalDays,
      now,
      now,
      card.id
    );

    // 4. Update daily stats
    const todayStr = getDateStringForRollover(now, options.rolloverHour);
    const isNewCard = card.state === CardState.New;

    await db.runAsync(
      `INSERT INTO daily_stats (date, deck_id, new_done, reviews_done, time_ms, goal_met)
       VALUES (?, ?, ?, ?, ?, 0)
       ON CONFLICT(date, deck_id) DO UPDATE SET
         new_done = new_done + excluded.new_done,
         reviews_done = reviews_done + excluded.reviews_done,
         time_ms = time_ms + excluded.time_ms;`,
      todayStr,
      card.deck_id,
      isNewCard ? 1 : 0,
      isNewCard ? 0 : 1,
      durationMs
    );

    // 5. Award XP
    const xpPoints = rating === Rating.Again ? 2 : rating === Rating.Hard ? 5 : 10;
    await db.runAsync(
      `INSERT INTO xp_log (id, source, amount, created_at)
       VALUES (?, 'study_answer', ?, ?);`,
      `xp_${now}_${Math.random().toString(36).substring(2, 5)}`,
      xpPoints,
      now
    );
    await db.runAsync(
      `UPDATE settings SET value = CAST(CAST(value AS INTEGER) + ? AS TEXT) WHERE key = 'xp_total';`,
      xpPoints
    );

    return next;
  },

  /**
   * Undoes the last reviewed card: reverts card fields and deletes review log
   */
  async undoLastReview(cardId: string): Promise<boolean> {
    const db = await getDatabase();
    const lastLog = await db.getFirstAsync<ReviewLog>(
      'SELECT * FROM review_logs WHERE card_id = ? ORDER BY reviewed_at DESC LIMIT 1;',
      cardId
    );
    if (!lastLog) return false;

    // Restore card state
    await db.runAsync(
      `UPDATE cards SET
         state = ?,
         due = ?,
         interval_days = ?,
         updated_at = ?
       WHERE id = ?;`,
      lastLog.state_before,
      lastLog.due_before,
      lastLog.interval_before,
      Date.now(),
      cardId
    );

    // Delete review log
    await db.runAsync('DELETE FROM review_logs WHERE id = ?;', lastLog.id);
    return true;
  },

  /**
   * Card Actions: Suspend, Bury, Flag, Reset
   */
  async suspendCard(cardId: string, suspend = true): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE cards SET suspended = ?, updated_at = ? WHERE id = ?;',
      suspend ? 1 : 0,
      Date.now(),
      cardId
    );
  },

  async buryCard(cardId: string, rolloverHour = 4): Promise<void> {
    const db = await getDatabase();
    const dayEnd = getDayEndTimestamp(Date.now(), rolloverHour);
    await db.runAsync(
      'UPDATE cards SET buried_until = ?, updated_at = ? WHERE id = ?;',
      dayEnd,
      Date.now(),
      cardId
    );
  },

  async flagCard(cardId: string, flag: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE cards SET flag = ?, updated_at = ? WHERE id = ?;',
      flag,
      Date.now(),
      cardId
    );
  },

  async resetCard(cardId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE cards SET
         state = 0,
         reps = 0,
         lapses = 0,
         interval_days = 0,
         ease_factor = 2.5,
         due = ?,
         last_review = NULL,
         updated_at = ?
       WHERE id = ?;`,
      Date.now(),
      Date.now(),
      cardId
    );
  },
};
