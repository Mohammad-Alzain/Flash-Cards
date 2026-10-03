import { NoteFieldDef, CardTemplateDef } from '../types/models';

export interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  isCloze?: boolean;
  fields: NoteFieldDef[];
  templates: CardTemplateDef[];
  css: string;
}

export const TEMPLATE_GALLERY_PRESETS: TemplatePreset[] = [
  {
    id: 'preset_classic_basic',
    name: '1. Classic Basic',
    description: 'Traditional flashcard with Front prompt and Back answer.',
    fields: [
      { id: 'f_front', name: 'Front', order: 0, rtl: false },
      { id: 'f_back', name: 'Back', order: 1, rtl: false },
    ],
    templates: [
      {
        id: 't_basic_1',
        name: 'Card 1',
        order: 0,
        front_html: '<div class="card front">{{Front}}</div>',
        back_html: '{{FrontSide}}\n<hr id="answer">\n<div class="card back">{{Back}}</div>',
      },
    ],
    css: `
      .card { font-size: 22px; text-align: center; padding: 20px; line-height: 1.6; }
      .nightMode .card { color: #f1f7fb; }
    `,
  },
  {
    id: 'preset_vocabulary_pro',
    name: '2. Vocabulary Pro (Word & Examples)',
    description: 'Rich language learning card with Word, Meaning, Example, and Pronunciation.',
    fields: [
      { id: 'f_word', name: 'Word', order: 0, rtl: false },
      { id: 'f_pos', name: 'Part of Speech', order: 1, rtl: false },
      { id: 'f_meaning', name: 'Meaning', order: 2, rtl: true },
      { id: 'f_example', name: 'Example', order: 3, rtl: false },
      { id: 'f_audio', name: 'Audio', order: 4, rtl: false },
    ],
    templates: [
      {
        id: 't_vocab_1',
        name: 'Card 1: Recognition',
        order: 0,
        front_html: `
          <div class="card vocab-front">
            <h1 class="word">{{Word}}</h1>
            {{#Part of Speech}}<span class="pos">({{Part of Speech}})</span>{{/Part of Speech}}
            {{#Audio}}<div class="audio-wrap">[sound:{{Audio}}]</div>{{/Audio}}
          </div>
        `,
        back_html: `
          {{FrontSide}}
          <hr id="answer">
          <div class="card vocab-back">
            <div class="meaning">{{Meaning}}</div>
            {{#Example}}
              <div class="example-box">
                <span class="example-label">Example:</span>
                <p class="example-text">"{{Example}}"</p>
              </div>
            {{/Example}}
          </div>
        `,
      },
    ],
    css: `
      .card { text-align: center; padding: 20px; }
      .word { font-size: 32px; font-weight: 800; color: #1cb0f6; margin: 0; }
      .pos { font-size: 14px; color: #888; font-style: italic; }
      .meaning { font-size: 24px; font-weight: bold; margin-top: 10px; color: #58cc02; }
      .example-box { margin-top: 16px; background: rgba(0,0,0,0.04); padding: 12px; border-radius: 10px; }
      .nightMode .example-box { background: rgba(255,255,255,0.06); }
      .example-text { font-style: italic; margin: 4px 0 0; }
    `,
  },
  {
    id: 'preset_reverse_typing',
    name: '3. Reverse + Typing Answer',
    description: 'Includes a forward card and a reverse card requiring typing the term.',
    fields: [
      { id: 'f_term', name: 'Term', order: 0, rtl: false },
      { id: 'f_definition', name: 'Definition', order: 1, rtl: false },
    ],
    templates: [
      {
        id: 't_typ_1',
        name: 'Card 1: Normal',
        order: 0,
        front_html: '<div class="card">{{Term}}</div>',
        back_html: '{{FrontSide}}<hr id="answer"><div class="card">{{Definition}}</div>',
      },
      {
        id: 't_typ_2',
        name: 'Card 2: Type Term',
        order: 1,
        front_html: '<div class="card"><p>{{Definition}}</p>{{type:Term}}</div>',
        back_html: '<div class="card"><p>{{Definition}}</p>{{type:Term}}</div>',
      },
    ],
    css: `
      .card { font-size: 20px; text-align: center; padding: 16px; }
    `,
  },
  {
    id: 'preset_cloze',
    name: '4. Cloze Deletion',
    description: 'Fill-in-the-blank style cards using {{c1::word::hint}} syntax.',
    isCloze: true,
    fields: [
      { id: 'f_text', name: 'Text', order: 0, rtl: false },
      { id: 'f_extra', name: 'Extra', order: 1, rtl: false },
    ],
    templates: [
      {
        id: 't_cloze_def',
        name: 'Cloze',
        order: 0,
        front_html: '<div class="card cloze-front">{{cloze:Text}}</div>',
        back_html: '<div class="card cloze-front">{{cloze:Text}}</div><hr id="answer"><div class="card extra">{{Extra}}</div>',
      },
    ],
    css: `
      .card { font-size: 22px; text-align: left; padding: 20px; line-height: 1.6; }
      .cloze { font-weight: bold; color: #1cb0f6; border-bottom: 2px dashed #1cb0f6; }
      .nightMode .cloze { color: #58cc02; border-bottom-color: #58cc02; }
      .extra { font-size: 16px; color: #777; margin-top: 10px; }
    `,
  },
  {
    id: 'preset_arabic_english',
    name: '5. Arabic ↔ English (Tashkeel & RTL)',
    description: 'Optimized layout for Arabic language learning with diacritics and Cairo/Amiri font.',
    fields: [
      { id: 'f_ar', name: 'الكلمة بالعربية', order: 0, rtl: true },
      { id: 'f_en', name: 'English Meaning', order: 1, rtl: false },
      { id: 'f_sentence', name: 'جملة مفيدة', order: 2, rtl: true },
    ],
    templates: [
      {
        id: 't_ar_1',
        name: 'العربية إلى الإنجليزية',
        order: 0,
        front_html: `
          <div class="card arabic-text" dir="rtl">
            <h1 class="arabic-word">{{الكلمة بالعربية}}</h1>
          </div>
        `,
        back_html: `
          {{FrontSide}}
          <hr id="answer">
          <div class="card" dir="ltr">
            <h2 class="english-word">{{English Meaning}}</h2>
            {{#جملة مفيدة}}
              <div class="arabic-sentence" dir="rtl">
                <span>مثال:</span> {{جملة مفيدة}}
              </div>
            {{/جملة مفيدة}}
          </div>
        `,
      },
      {
        id: 't_ar_2',
        name: 'English to Arabic',
        order: 1,
        front_html: `
          <div class="card" dir="ltr">
            <h1 class="english-word">{{English Meaning}}</h1>
          </div>
        `,
        back_html: `
          {{FrontSide}}
          <hr id="answer">
          <div class="card arabic-text" dir="rtl">
            <h2 class="arabic-word">{{الكلمة بالعربية}}</h2>
          </div>
        `,
      },
    ],
    css: `
      .card { text-align: center; padding: 20px; }
      .arabic-word { font-family: 'Amiri', 'Cairo', serif; font-size: 36px; color: #58cc02; margin: 0; }
      .english-word { font-family: 'Nunito', sans-serif; font-size: 26px; color: #1cb0f6; margin: 0; }
      .arabic-sentence { font-size: 20px; margin-top: 14px; background: rgba(88,204,2,0.1); padding: 10px; border-radius: 8px; }
    `,
  },
  {
    id: 'preset_medical_qa',
    name: '6. Medical & University Q&A',
    description: 'Clinical vignettes, key symptoms, diagnoses, and rationale notes.',
    fields: [
      { id: 'f_case', name: 'Clinical Question', order: 0, rtl: false },
      { id: 'f_answer', name: 'Diagnosis / Answer', order: 1, rtl: false },
      { id: 'f_rationale', name: 'Key Rationale', order: 2, rtl: false },
    ],
    templates: [
      {
        id: 't_med_1',
        name: 'Clinical Recall',
        order: 0,
        front_html: '<div class="card case-stem"><strong>Case:</strong><p>{{Clinical Question}}</p></div>',
        back_html: `
          {{FrontSide}}
          <hr id="answer">
          <div class="card answer-box">
            <h2 class="diagnosis">{{Diagnosis / Answer}}</h2>
            {{#Key Rationale}}
              <div class="rationale-box">
                <strong>Why:</strong> {{Key Rationale}}
              </div>
            {{/Key Rationale}}
          </div>
        `,
      },
    ],
    css: `
      .card { text-align: left; padding: 18px; font-size: 18px; line-height: 1.5; }
      .diagnosis { color: #58cc02; margin-top: 0; }
      .rationale-box { background: rgba(28,176,246,0.1); border-left: 4px solid #1cb0f6; padding: 10px; border-radius: 4px; margin-top: 10px; }
    `,
  },
  {
    id: 'preset_minimal_dark',
    name: '7. Minimal High-Contrast (Accessibility)',
    description: 'Clean, extra-large fonts with high contrast for rapid review and accessibility.',
    fields: [
      { id: 'f_front', name: 'Front', order: 0, rtl: false },
      { id: 'f_back', name: 'Back', order: 1, rtl: false },
    ],
    templates: [
      {
        id: 't_min_1',
        name: 'High Contrast',
        order: 0,
        front_html: '<div class="card front-text">{{Front}}</div>',
        back_html: '{{FrontSide}}<hr id="answer"><div class="card back-text">{{Back}}</div>',
      },
    ],
    css: `
      .card { font-size: 30px; font-weight: bold; text-align: center; padding: 30px; letter-spacing: 0.5px; }
      .front-text { color: #1cb0f6; }
      .back-text { color: #58cc02; }
    `,
  },
];
