/**
 * Core Data Models (SQLite schema entities)
 */

export interface Deck {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
  new_per_day: number;
  reviews_per_day: number;
  settings_json: string | null;
  archived: number; // 0 or 1
  // Joined or computed fields
  card_count?: number;
  new_count?: number;
  learn_count?: number;
  due_count?: number;
  children?: Deck[];
}

export interface NoteFieldDef {
  id: string;
  name: string;
  order: number;
  rtl: boolean;
  font?: string;
  size?: number;
  sticky?: boolean;
  collapsed?: boolean;
  description?: string;
}

export interface CardTemplateDef {
  id: string;
  name: string;
  order: number;
  front_html: string;
  back_html: string;
  browser_q?: string;
  browser_a?: string;
  deck_override_id?: string | null;
}

export interface NoteType {
  id: string;
  name: string;
  fields_json: string; // serialized NoteFieldDef[]
  templates_json: string; // serialized CardTemplateDef[]
  css: string;
  is_cloze: number; // 0 or 1
  created_at: number;
}

export interface NoteTypeVersion {
  id: string;
  note_type_id: string;
  snapshot_json: string;
  saved_at: number;
}

export interface Note {
  id: string;
  guid: string;
  note_type_id: string;
  fields_json: string; // Record<string, string> (field name/id -> content)
  tags: string; // space or comma separated
  sort_field: string;
  checksum: number;
  created_at: number;
  updated_at: number;
}

export enum CardState {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export interface Card {
  id: string;
  note_id: string;
  deck_id: string;
  template_ord: number;
  state: CardState;
  due: number; // ms timestamp or day offset
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  ease_factor: number; // e.g. 2.5 (2500 in Anki legacy)
  interval_days: number;
  last_review: number | null;
  suspended: number; // 0 or 1
  buried_until: number | null;
  flag: number; // 0 to 7
  bookmarked: number; // 0 or 1
  created_at: number;
  updated_at: number;
  
  // Optional joined fields for study UI
  front_html?: string;
  back_html?: string;
  fields?: Record<string, string>;
  deck_name?: string;
}

export interface ReviewLog {
  id: string;
  card_id: string;
  deck_id: string;
  rating: number; // 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
  state_before: number;
  due_before: number;
  interval_before: number;
  interval_after: number;
  duration_ms: number;
  reviewed_at: number;
}

export interface MediaFile {
  id: string;
  filename: string;
  mime: string;
  size: number;
  hash: string;
}

export interface Schedule {
  id: string;
  deck_id: string | null;
  type: 'study' | 'review' | 'custom';
  time_of_day: string; // "07:30"
  days_of_week_mask: number; // bitmask e.g. Mon-Fri
  duration_min: number;
  enabled: number;
  /** Comma-separated scheduled notification ids (one per weekday when not daily). */
  notification_id: string | null;
  /** Comma-separated phone-calendar event ids, when linked to the calendar. */
  calendar_event_ids?: string | null;
  created_at: number;
}

export interface StudySession {
  id: string;
  deck_id: string;
  mode: string;
  started_at: number;
  ended_at: number;
  cards_seen: number;
  new_count: number;
  review_count: number;
  correct_count: number;
}

export interface DailyStat {
  date: string; // YYYY-MM-DD
  deck_id: string;
  new_done: number;
  reviews_done: number;
  time_ms: number;
  goal_met: number;
}

export interface AppSetting {
  key: string;
  value: string;
}

export interface ImportHistoryItem {
  id: string;
  source_type: string;
  filename: string;
  imported_at: number;
  notes_added: number;
  notes_skipped: number;
  errors_json: string | null;
}
