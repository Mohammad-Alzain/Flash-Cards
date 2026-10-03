/**
 * Anki Search Syntax Parser -> SQL WHERE clauses (Section 8D)
 * Pure TypeScript module supporting:
 * - deck:name
 * - tag:tag_name
 * - is:due, is:new, is:learn, is:suspended, is:buried
 * - prop:ease<2.5, prop:reps>5, prop:lapses>3, prop:due<=0
 * - added:7 (days)
 * - negation with "-" (e.g. -is:suspended, -tag:hard)
 * - free text search across note fields
 */

export interface ParsedSearchQuery {
  whereClause: string;
  params: any[];
}

export const searchParser = {
  parse(query: string, now: number = Date.now()): ParsedSearchQuery {
    const trimmed = query.trim();
    if (!trimmed) {
      return { whereClause: '1=1', params: [] };
    }

    // Tokenize by spaces while respecting quotes
    const regex = /(-?[a-zA-Z0-9_]+:(?:"[^"]+"|[^\s]+)|"[^"]+"|[^\s]+)/g;
    const tokens: string[] = [];
    let match;
    while ((match = regex.exec(trimmed)) !== null) {
      tokens.push(match[1]);
    }

    const conditions: string[] = [];
    const params: any[] = [];

    for (const token of tokens) {
      const isNegated = token.startsWith('-');
      const cleanToken = isNegated ? token.substring(1) : token;

      if (cleanToken.startsWith('deck:')) {
        const val = cleanToken.replace('deck:', '').replace(/^"|"$/g, '');
        if (isNegated) {
          conditions.push('d.name NOT LIKE ?');
        } else {
          conditions.push('d.name LIKE ?');
        }
        params.push(`%${val}%`);
      } else if (cleanToken.startsWith('tag:')) {
        const val = cleanToken.replace('tag:', '').replace(/^"|"$/g, '');
        if (isNegated) {
          conditions.push('n.tags NOT LIKE ?');
        } else {
          conditions.push('n.tags LIKE ?');
        }
        params.push(`%${val}%`);
      } else if (cleanToken.startsWith('is:')) {
        const val = cleanToken.replace('is:', '').toLowerCase();
        let cond = '';
        if (val === 'due') {
          cond = `(c.state = 2 AND c.due <= ${now} AND c.suspended = 0)`;
        } else if (val === 'new') {
          cond = 'c.state = 0';
        } else if (val === 'learn') {
          cond = '(c.state = 1 OR c.state = 3)';
        } else if (val === 'review') {
          cond = 'c.state = 2';
        } else if (val === 'studied') {
          cond = '(c.state != 0 OR c.reps > 0)';
        } else if (val === 'suspended') {
          cond = 'c.suspended = 1';
        } else if (val === 'buried') {
          cond = `(c.buried_until IS NOT NULL AND c.buried_until > ${now})`;
        }

        if (cond) {
          conditions.push(isNegated ? `NOT (${cond})` : cond);
        }
      } else if (cleanToken.startsWith('prop:')) {
        // e.g. prop:ease<2.5, prop:reps>5, prop:lapses>3
        const expr = cleanToken.replace('prop:', '');
        const propMatch = expr.match(/^(ease|reps|lapses|due)(<=|>=|<|>|=)([-0-9.]+)$/);
        if (propMatch) {
          const [, prop, op, valStr] = propMatch;
          const numVal = parseFloat(valStr);
          let col = '';
          if (prop === 'ease') col = 'c.ease_factor';
          else if (prop === 'reps') col = 'c.reps';
          else if (prop === 'lapses') col = 'c.lapses';
          else if (prop === 'due') col = 'c.interval_days';

          if (col) {
            conditions.push(`${col} ${op} ?`);
            params.push(numVal);
          }
        }
      } else if (cleanToken.startsWith('added:')) {
        const days = parseInt(cleanToken.replace('added:', ''), 10) || 7;
        const sinceMs = now - days * 86400 * 1000;
        conditions.push(isNegated ? 'c.created_at < ?' : 'c.created_at >= ?');
        params.push(sinceMs);
      } else {
        // Free text search in note fields or sort field
        const word = cleanToken.replace(/^"|"$/g, '');
        if (word) {
          if (isNegated) {
            conditions.push('(n.fields_json NOT LIKE ? AND n.sort_field NOT LIKE ?)');
          } else {
            conditions.push('(n.fields_json LIKE ? OR n.sort_field LIKE ?)');
          }
          params.push(`%${word}%`);
          params.push(`%${word}%`);
        }
      }
    }

    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';
    return { whereClause, params };
  },
};
