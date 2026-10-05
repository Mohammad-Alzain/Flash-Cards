export interface FieldDef {
  id: string;
  name: string;
  ord: number;
}

export const DEFAULT_FIELDS: FieldDef[] = [
  { id: 'f0', name: 'Front', ord: 0 },
  { id: 'f1', name: 'Back', ord: 1 },
];

/** Parses a note type's `fields_json` (array of names or field objects). */
export const parseFieldDefs = (fieldsJson: string | null | undefined): FieldDef[] => {
  try {
    const parsed = JSON.parse(fieldsJson || '[]');
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any, idx: number) => ({
        id: item?.id || `f_${idx}`,
        name: typeof item === 'string' ? item : item?.name || `Field ${idx + 1}`,
        ord: idx,
      }));
    }
  } catch {}
  return DEFAULT_FIELDS;
};

/** First `[sound:file]` reference in a field's content. */
export const firstSoundFile = (content: string): string | null => content.match(/\[sound:([^\]]+)\]/)?.[1] ?? null;
