import { SQLiteDatabase } from 'expo-sqlite';
import { CardState } from '../types/models';

export async function seedInitialData(db: SQLiteDatabase): Promise<void> {
  // Check if note types already exist
  const existingTypes = await db.getAllAsync<{ id: string }>('SELECT id FROM note_types LIMIT 1;');
  if (existingTypes.length > 0) {
    return; // Already seeded
  }

  const now = Date.now();

  // 1. Built-in Note Types
  const basicFields = [
    { id: 'f_front', name: 'Front', order: 0, rtl: false },
    { id: 'f_back', name: 'Back', order: 1, rtl: true },
  ];
  const basicTemplates = [
    {
      id: 't_basic_1',
      name: 'Card 1',
      order: 0,
      front_html: '{{Front}}',
      back_html: '{{FrontSide}}\n<hr id="answer">\n{{Back}}',
    },
  ];
  const defaultCSS = `
    .card {
      font-family: 'Cairo', 'Nunito', sans-serif;
      font-size: 22px;
      text-align: center;
      color: #333;
      padding: 16px;
    }
    .nightMode .card {
      color: #eee;
    }
    #answer {
      border: 0;
      height: 1px;
      background: #ccc;
      margin: 16px 0;
    }
  `;

  await db.runAsync(
    `INSERT INTO note_types (id, name, fields_json, templates_json, css, is_cloze, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    'nt_basic',
    'Basic',
    JSON.stringify(basicFields),
    JSON.stringify(basicTemplates),
    defaultCSS,
    0,
    now
  );

  // Basic (and reversed)
  const reversedTemplates = [
    {
      id: 't_rev_1',
      name: 'Card 1 (Forward)',
      order: 0,
      front_html: '{{Front}}',
      back_html: '{{FrontSide}}\n<hr id="answer">\n{{Back}}',
    },
    {
      id: 't_rev_2',
      name: 'Card 2 (Reverse)',
      order: 1,
      front_html: '{{Back}}',
      back_html: '{{FrontSide}}\n<hr id="answer">\n{{Front}}',
    },
  ];
  await db.runAsync(
    `INSERT INTO note_types (id, name, fields_json, templates_json, css, is_cloze, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    'nt_basic_reversed',
    'Basic (and reversed card)',
    JSON.stringify(basicFields),
    JSON.stringify(reversedTemplates),
    defaultCSS,
    0,
    now
  );

  // Cloze
  const clozeFields = [
    { id: 'f_text', name: 'Text', order: 0, rtl: false },
    { id: 'f_extra', name: 'Extra', order: 1, rtl: true },
  ];
  const clozeTemplates = [
    {
      id: 't_cloze_1',
      name: 'Cloze',
      order: 0,
      front_html: '{{cloze:Text}}',
      back_html: '{{cloze:Text}}\n<hr id="answer">\n{{Extra}}',
    },
  ];
  await db.runAsync(
    `INSERT INTO note_types (id, name, fields_json, templates_json, css, is_cloze, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    'nt_cloze',
    'Cloze',
    JSON.stringify(clozeFields),
    JSON.stringify(clozeTemplates),
    defaultCSS,
    1,
    now
  );

  // 2. Default Settings
  const defaultSettings = [
    ['theme_mode', 'light'],
    ['language', 'ar'],
    ['daily_goal', '20'],
    ['rollover_hour', '4'],
    ['fsrs_enabled', '1'],
    ['haptics_enabled', '1'],
    ['sound_enabled', '1'],
    ['auto_play_audio', '1'],
    ['xp_total', '120'],
    ['streak_current', '3'],
    ['streak_longest', '7'],
  ];

  for (const [key, value] of defaultSettings) {
    await db.runAsync(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?);',
      key,
      value
    );
  }

  // 3. Create Sample Deck
  const sampleDeckId = 'deck_sample_1';
  await db.runAsync(
    `INSERT INTO decks (id, parent_id, name, description, created_at, updated_at, new_per_day, reviews_per_day)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?);`,
    sampleDeckId,
    'مفردات إنجليزية شائعة (Common Vocab)',
    'حزمة تجريبية تحتوي على مفردات إنجليزية هامة مع معانيها وأمثلتها بالعربية',
    now,
    now,
    20,
    100
  );

  // 4. Sample Notes & Cards
  const sampleCards = [
    {
      id: 'note_1',
      front: 'Resilience',
      back: 'المرونة والقدرة على التعافي بسرعة من الصعوبات والشدائد',
      dueOffset: -3600000, // Due 1 hour ago (Review ready)
      state: CardState.Review,
      reps: 2,
    },
    {
      id: 'note_2',
      front: 'Serendipity',
      back: 'العثور على أشياء جميلة ونافعة بالصدفة ودون تخطيط مسبق',
      dueOffset: -1800000, // Due 30 min ago (Review ready)
      state: CardState.Review,
      reps: 3,
    },
    {
      id: 'note_3',
      front: 'Perseverance',
      back: 'المواظبة والإصرار على بلوغ الهدف رغم العوائق والتحديات',
      dueOffset: 0,
      state: CardState.New,
      reps: 0,
    },
    {
      id: 'note_4',
      front: 'Eloquent',
      back: 'فصيح وبليغ، ذو بيان واضح وأسلوب مؤثر في التعبير',
      dueOffset: 0,
      state: CardState.New,
      reps: 0,
    },
    {
      id: 'note_5',
      front: 'Empathy',
      back: 'التعاطف الصادق والقدرة على فهم ومشاركة مشاعر الآخرين',
      dueOffset: 0,
      state: CardState.New,
      reps: 0,
    },
  ];

  for (let i = 0; i < sampleCards.length; i++) {
    const sc = sampleCards[i];
    const noteId = `note_seed_${i + 1}`;
    const cardId = `card_seed_${i + 1}`;
    const fields = {
      Front: sc.front,
      Back: sc.back,
    };

    // Note
    await db.runAsync(
      `INSERT INTO notes (id, guid, note_type_id, fields_json, tags, sort_field, checksum, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      noteId,
      `guid_seed_${i + 1}`,
      'nt_basic',
      JSON.stringify(fields),
      'vocab,sample',
      sc.front,
      0,
      now,
      now
    );

    // Card
    const cardDue = sc.state === CardState.Review ? now + sc.dueOffset : now;
    await db.runAsync(
      `INSERT INTO cards (
         id, note_id, deck_id, template_ord, state, due, stability, difficulty,
         elapsed_days, scheduled_days, reps, lapses, ease_factor, interval_days,
         last_review, suspended, buried_until, flag, bookmarked, created_at, updated_at
       ) VALUES (
         ?, ?, ?, 0, ?, ?, 2.0, 3.0,
         1, 1, ?, 0, 2.5, 1,
         ?, 0, NULL, 0, 0, ?, ?
       );`,
      cardId,
      noteId,
      sampleDeckId,
      sc.state,
      cardDue,
      sc.reps,
      sc.state === CardState.Review ? now - 86400000 : null,
      now,
      now
    );
  }

  // 5. Initial Daily Stats
  const todayStr = new Date().toISOString().split('T')[0];
  await db.runAsync(
    `INSERT OR IGNORE INTO daily_stats (date, deck_id, new_done, reviews_done, time_ms, goal_met)
     VALUES (?, ?, 3, 5, 240000, 0);`,
    todayStr,
    sampleDeckId
  );

  console.log('[DB] Seeding completed successfully.');
}
