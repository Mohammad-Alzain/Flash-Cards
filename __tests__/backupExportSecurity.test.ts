import { exportToDelimitedText } from '../src/core/exporters/csvExporter';
import { exportToXlsxBase64 } from '../src/core/exporters/xlsxExporter';
import { sha256 } from '../src/core/security/sha256';
import { NoteExportData } from '../src/core/exporters/types';

describe('Phase 9: Export, Backup & Security Unit Tests', () => {
  const sampleNotes: NoteExportData[] = [
    {
      id: 'n1',
      guid: 'guid1',
      deckName: 'Arabic Vocab',
      deckId: 'd1',
      noteTypeName: 'Basic',
      fields: {
        Front: 'كتاب',
        Back: 'Book, reading material',
      },
      fieldNames: ['Front', 'Back'],
      tags: ['vocab', 'arabic'],
      cards: [
        {
          id: 'c1',
          templateOrd: 0,
          state: 2,
          due: 15,
          stability: 10,
          difficulty: 0.3,
          elapsedDays: 5,
          scheduledDays: 10,
          reps: 4,
          lapses: 0,
          easeFactor: 2.5,
          intervalDays: 10,
          lastReview: Date.now() - 86400000,
          suspended: false,
          flag: 1,
        },
      ],
    },
    {
      id: 'n2',
      guid: 'guid2',
      deckName: 'Arabic Vocab',
      deckId: 'd1',
      noteTypeName: 'Basic',
      fields: {
        Front: 'بيت',
        Back: 'House, "home"',
      },
      fieldNames: ['Front', 'Back'],
      tags: ['beginner'],
      cards: [],
    },
  ];

  describe('CSV & TSV Exporter', () => {
    it('prepends UTF-8 BOM so Excel displays Arabic characters properly', () => {
      const csv = exportToDelimitedText(sampleNotes, { delimiter: ',' });
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('كتاب');
      expect(csv).toContain('بيت');
    });

    it('escapes cells containing commas and double quotes', () => {
      const csv = exportToDelimitedText(sampleNotes, { delimiter: ',' });
      expect(csv).toContain('"Book, reading material"');
      expect(csv).toContain('"House, ""home"""');
    });

    it('includes Anki separator headers', () => {
      const csv = exportToDelimitedText(sampleNotes, { delimiter: ',' });
      expect(csv).toContain('#separator:comma');
      expect(csv).toContain('#html:true');

      const tsv = exportToDelimitedText(sampleNotes, { delimiter: '\t' });
      expect(tsv).toContain('#separator:tab');
    });

    it('includes scheduling data when enabled', () => {
      const csv = exportToDelimitedText(sampleNotes, { delimiter: ',', includeScheduling: true });
      expect(csv).toContain('IntervalDays');
      expect(csv).toContain('Reps');
    });
  });

  describe('XLSX Exporter', () => {
    it('generates a valid base64 Excel spreadsheet', () => {
      const base64 = exportToXlsxBase64(sampleNotes);
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(50);
      // Valid Base64 check
      expect(() => Buffer.from(base64, 'base64')).not.toThrow();
    });

    it('handles empty notes array without throwing', () => {
      const base64 = exportToXlsxBase64([]);
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);
    });
  });

  describe('Pure TypeScript SHA-256 & Security', () => {
    it('matches standard NIST test vectors', () => {
      // Empty string
      expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

      // "1234"
      expect(sha256('1234')).toBe('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4');

      // "hello world"
      expect(sha256('hello world')).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    it('computes consistent hashes for salted PINs', () => {
      const pin = '4321';
      const salt = 'random_hex_salt_9876543210';
      const hash1 = sha256(pin + salt);
      const hash2 = sha256(pin + salt);
      const hashWrongPin = sha256('4322' + salt);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hashWrongPin);
    });
  });
});
