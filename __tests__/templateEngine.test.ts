import {
  renderCard,
  stripHtml,
  extractClozeIndices,
  renderCloze,
  isFieldNonEmpty,
} from '../src/core/render/templateEngine';

describe('Anki-compatible Template Engine (Section 8A.4)', () => {
  test('replaces basic fields {{Front}} and {{Back}}', () => {
    const result = renderCard({
      frontTemplate: '<div>{{Front}}</div>',
      backTemplate: '{{FrontSide}}<hr id="answer"><div>{{Back}}</div>',
      fields: {
        Front: 'Eloquent',
        Back: 'فصيح وبليغ',
      },
    });

    expect(result.frontHtml).toContain('Eloquent');
    expect(result.backHtml).toContain('Eloquent');
    expect(result.backHtml).toContain('فصيح وبليغ');
    expect(result.hasEmptyFront).toBe(false);
  });

  test('handles positive conditional {{#Field}}', () => {
    const frontTpl = '{{Front}}{{#Extra}}<br>Extra: {{Extra}}{{/Extra}}';
    const backTpl = '{{Back}}';

    // When Extra is provided
    const withExtra = renderCard({
      frontTemplate: frontTpl,
      backTemplate: backTpl,
      fields: { Front: 'Word', Back: 'Meaning', Extra: 'Important note' },
    });
    expect(withExtra.frontHtml).toContain('Extra: Important note');

    // When Extra is empty
    const withoutExtra = renderCard({
      frontTemplate: frontTpl,
      backTemplate: backTpl,
      fields: { Front: 'Word', Back: 'Meaning', Extra: '' },
    });
    expect(withoutExtra.frontHtml).not.toContain('Extra:');
  });

  test('handles inverted conditional {{^Field}}', () => {
    const frontTpl = '{{Front}}{{^Pronunciation}} [no audio] {{/Pronunciation}}';
    const backTpl = '{{Back}}';

    const result = renderCard({
      frontTemplate: frontTpl,
      backTemplate: backTpl,
      fields: { Front: 'Word', Back: 'Meaning', Pronunciation: '' },
    });
    expect(result.frontHtml).toContain('[no audio]');
  });

  test('renders cloze deletion {{cloze:Text}} for c1 and c2', () => {
    const clozeText = 'Canberra is the capital of {{c1::Australia::country}} and founded in {{c2::1913}}.';

    // Card 1 Front
    const card1 = renderCard({
      frontTemplate: '{{cloze:Text}}',
      backTemplate: '{{cloze:Text}}<br>{{Extra}}',
      templateOrd: 0, // Cloze 1
      fields: { Text: clozeText, Extra: 'Geography fact' },
    });

    expect(card1.frontHtml).toContain('[country]');
    expect(card1.frontHtml).toContain('1913'); // Non-target cloze shows full answer
    expect(card1.backHtml).toContain('<span class="cloze">Australia</span>');

    // Card 2 Front
    const card2 = renderCard({
      frontTemplate: '{{cloze:Text}}',
      backTemplate: '{{cloze:Text}}',
      templateOrd: 1, // Cloze 2
      fields: { Text: clozeText },
    });

    expect(card2.frontHtml).toContain('Australia');
    expect(card2.frontHtml).toContain('[...]');
    expect(card2.backHtml).toContain('<span class="cloze">1913</span>');

    expect(card1.clozeNumbers).toEqual([1, 2]);
  });

  test('strips HTML with {{text:Field}}', () => {
    const result = renderCard({
      frontTemplate: '{{text:Formatted}}',
      backTemplate: '{{Formatted}}',
      fields: { Formatted: '<strong>Bold</strong> and <em>Italic</em>' },
    });

    expect(result.frontHtml).toBe('Bold and Italic');
    expect(result.backHtml).toContain('<strong>Bold</strong>');
  });

  test('handles {{type:Field}} evaluation', () => {
    const resultCorrect = renderCard({
      frontTemplate: '{{type:Answer}}',
      backTemplate: '{{type:Answer}}',
      fields: { Answer: 'Paris' },
      userInput: 'Paris',
    });
    expect(resultCorrect.backHtml).toContain('type-correct');

    const resultWrong = renderCard({
      frontTemplate: '{{type:Answer}}',
      backTemplate: '{{type:Answer}}',
      fields: { Answer: 'Paris' },
      userInput: 'London',
    });
    expect(resultWrong.backHtml).toContain('type-incorrect');
    expect(resultWrong.backHtml).toContain('Expected: <strong>Paris</strong>');
  });

  test('detects empty front cards correctly', () => {
    const emptyResult = renderCard({
      frontTemplate: '{{Front}}',
      backTemplate: '{{Back}}',
      fields: { Front: '   ', Back: 'Valid Back' },
    });
    expect(emptyResult.hasEmptyFront).toBe(true);

    const filledResult = renderCard({
      frontTemplate: '{{Front}}',
      backTemplate: '{{Back}}',
      fields: { Front: 'Valid Question', Back: 'Valid Back' },
    });
    expect(filledResult.hasEmptyFront).toBe(false);
  });

  test('handles Arabic RTL content smoothly with special tags', () => {
    const result = renderCard({
      frontTemplate: '<div dir="rtl">{{سؤال}}</div>',
      backTemplate: '{{FrontSide}}<hr id="answer"><div dir="rtl">{{جواب}}</div>',
      deckName: 'اللغة العربية::المفردات',
      fields: {
        سؤال: 'ما معنى الصمود؟',
        جواب: 'القدرة على الثبات في وجه الصعاب',
      },
    });

    expect(result.frontHtml).toContain('ما معنى الصمود؟');
    expect(result.backHtml).toContain('القدرة على الثبات في وجه الصعاب');
    expect(result.fullFrontPage).toContain('dir="rtl"');
  });
});
