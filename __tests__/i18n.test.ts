import en from '../src/i18n/translations/en.json';
import ar from '../src/i18n/translations/ar.json';

describe('i18n translation integrity', () => {
  function getKeys(obj: Record<string, any>, prefix = ''): string[] {
    return Object.keys(obj).reduce((res: string[], el: string) => {
      if (Array.isArray(obj[el])) {
        return res;
      } else if (typeof obj[el] === 'object' && obj[el] !== null) {
        return [...res, ...getKeys(obj[el], prefix + el + '.')];
      }
      return [...res, prefix + el];
    }, []);
  }

  test('Arabic and English translation keys must match exactly', () => {
    const enKeys = getKeys(en).sort();
    const arKeys = getKeys(ar).sort();

    expect(arKeys).toEqual(enKeys);
  });

  test('Translations should not have empty values', () => {
    function checkNonEmpty(obj: Record<string, any>, lang: string) {
      for (const [key, val] of Object.entries(obj)) {
        if (typeof val === 'string') {
          expect(val.trim().length).toBeGreaterThan(0);
        } else if (typeof val === 'object' && val !== null) {
          checkNonEmpty(val, lang);
        }
      }
    }

    checkNonEmpty(en, 'en');
    checkNonEmpty(ar, 'ar');
  });
});
