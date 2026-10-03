import { searchParser } from '../src/core/search/searchParser';

describe('Anki Search Syntax Parser (Section 8D)', () => {
  test('parses deck: and tag: filters', () => {
    const res = searchParser.parse('deck:Vocab tag:verbs');
    expect(res.whereClause).toContain('d.name LIKE ?');
    expect(res.whereClause).toContain('n.tags LIKE ?');
    expect(res.params).toEqual(['%Vocab%', '%verbs%']);
  });

  test('parses is:due, is:new, and is:suspended', () => {
    const res = searchParser.parse('is:due is:new');
    expect(res.whereClause).toContain('c.state = 2');
    expect(res.whereClause).toContain('c.state = 0');
  });

  test('handles negation with "-" prefix', () => {
    const res = searchParser.parse('-is:suspended -tag:easy');
    expect(res.whereClause).toContain('NOT (c.suspended = 1)');
    expect(res.whereClause).toContain('n.tags NOT LIKE ?');
    expect(res.params).toEqual(['%easy%']);
  });

  test('parses prop: operators (ease, reps, lapses)', () => {
    const res = searchParser.parse('prop:ease<2.5 prop:reps>=3 prop:lapses>1');
    expect(res.whereClause).toContain('c.ease_factor < ?');
    expect(res.whereClause).toContain('c.reps >= ?');
    expect(res.whereClause).toContain('c.lapses > ?');
    expect(res.params).toEqual([2.5, 3, 1]);
  });

  test('parses free text search across fields', () => {
    const res = searchParser.parse('Resilience');
    expect(res.whereClause).toContain('n.fields_json LIKE ? OR n.sort_field LIKE ?');
    expect(res.params).toEqual(['%Resilience%', '%Resilience%']);
  });
});
