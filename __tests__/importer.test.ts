import { textImporter } from '../src/core/importers/textImporter';

describe('Text and CSV Importer (Section 4.3)', () => {
  test('detects tab delimiter from Anki header #separator:tab', () => {
    const content = '#separator:tab\n#html:true\nFront\tBack\nHello\tمرحباً';
    const delimiter = textImporter.detectDelimiter(content);
    expect(delimiter).toBe('\t');
  });

  test('detects comma delimiter in regular CSV', () => {
    const content = 'Question,Answer,Notes\nWhat is React?,A library,JS';
    const delimiter = textImporter.detectDelimiter(content);
    expect(delimiter).toBe(',');
  });

  test('parses Quizlet-style paste format (term - def and tab)', () => {
    const rawPaste = `
Resilience - المرونة
Serendipity - العثور على الجمال بالصدفة
Eloquent\tفصيح وبليغ
`;
    const candidates = textImporter.parsePastedText(rawPaste);
    expect(candidates.length).toBe(3);
    expect(candidates[0].fields['Front']).toBe('Resilience');
    expect(candidates[0].fields['Back']).toBe('المرونة');
    expect(candidates[2].fields['Front']).toBe('Eloquent');
    expect(candidates[2].fields['Back']).toBe('فصيح وبليغ');
  });

  test('parses full content with custom column mapping', () => {
    const rawCsv = 'Bonjour,Hello,Greeting\nMerci,Thank you,Polite';
    const candidates = textImporter.parseFullContent(rawCsv, {
      targetDeckId: 'deck_1',
      noteTypeId: 'nt_1',
      duplicateStrategy: 'skip',
      keepScheduling: false,
      columnMapping: {
        0: 'Front',
        1: 'Back',
        2: '__tags__',
      },
    });

    expect(candidates.length).toBe(2);
    expect(candidates[0].fields['Front']).toBe('Bonjour');
    expect(candidates[0].fields['Back']).toBe('Hello');
    expect(candidates[0].tags).toBe('Greeting');
  });
});
