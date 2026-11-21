// Faster drop-in for csv-reader 1.0.0, written from scratch.
// Semantics (from the kit RULES): BOM dropped; records end at LF/CRLF;
// empty lines are no record; lone CR outside quotes is dropped
// (stray_cr); a field opening with a quote runs to the next non-doubled
// quote, "" -> ", CRLF/lone CR inside -> LF; junk after the closing
// quote is appended as-is (quote_junk if anything was added); a quote
// that never closes is literal and the rest is re-read unquoted
// (unterminated_quote); quotes inside unquoted fields are literal;
// fields stay strings; columns = first record iff header, rows are
// padded (short_row, fields: count) or cut (long_row, extra: cut
// fields) to the first record's width; errors {code, line, row} in
// encounter order, line/row = the record's start line / rows index
// (null for the header).
// Speed: the reference walks one character at a time building fields
// with +=. This parser finds boundaries with native indexOf and
// slices fields out. Key trick: it never scans for '\r' over the
// whole remaining text (in LF files that scans thousands of chars
// per field); it only looks for ',' and '\n', then checks the short
// sliced field for a '\r' (stray CRs are rare). No caching across
// cases, no dependencies, no per-field object allocation (the
// unquoted helper returns the string and reports ended/added in
// shared locals).

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  const len = text.length;
  let pos = 0;
  let line = 1;
  if (len > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;
  // Result of the last unquoted() call: 0=comma, 1=line break, 2=end.
  let uEnded = 2;
  let uAdded = 0;

  // Unquoted field starting at pos, with `initial` already in the
  // value. Returns the field string; sets uEnded/uAdded (added =
  // kept characters after initial, stray CRs dropped, not counted).
  // Updates pos/line, pushes stray_cr errors for this record.
  function unquoted(initial, recordLine, recordRow) {
    let value = initial;
    let added = 0;
    let start = pos;
    for (;;) {
      let comma = text.indexOf(',', pos);
      let nl = text.indexOf('\n', pos);
      if (comma < 0) comma = Infinity;
      if (nl < 0) nl = Infinity;
      if (comma < nl) {
        const s = text.slice(start, comma);
        const cr = s.indexOf('\r');
        if (cr < 0) {
          value += s; added += s.length; pos = comma + 1;
          uEnded = 0; uAdded = added; return value;
        }
        // Rare: one or more stray CRs in this field; drop them.
        let n = 0;
        for (let i = cr; i < s.length; i++) if (s.charCodeAt(i) === 13) n++;
        for (let i = 0; i < n; i++) errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        const clean = s.replaceAll('\r', '');
        value += clean; added += clean.length; pos = comma + 1;
        uEnded = 0; uAdded = added; return value;
      }
      if (nl < Infinity) {
        const s = text.slice(start, nl);
        const cr = s.indexOf('\r');
        if (cr < 0) {
          value += s; added += s.length; pos = nl + 1; line++;
          uEnded = 1; uAdded = added; return value;
        }
        // A trailing '\r' is the CRLF line break (no error); any
        // other '\r' in the field is a stray CR.
        const body = s.charCodeAt(s.length - 1) === 13 ? s.slice(0, -1) : s;
        const bcr = body.indexOf('\r');
        if (bcr < 0) {
          value += body; added += body.length; pos = nl + 1; line++;
          uEnded = 1; uAdded = added; return value;
        }
        let n = 0;
        for (let i = bcr; i < body.length; i++) if (body.charCodeAt(i) === 13) n++;
        for (let i = 0; i < n; i++) errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        const clean = body.replaceAll('\r', '');
        value += clean; added += clean.length; pos = nl + 1; line++;
        uEnded = 1; uAdded = added; return value;
      }
      // End of text.
      const s = text.slice(start);
      const cr = s.indexOf('\r');
      if (cr < 0) {
        value += s; added += s.length; pos = len;
        uEnded = 2; uAdded = added; return value;
      }
      let n = 0;
      for (let i = cr; i < s.length; i++) if (s.charCodeAt(i) === 13) n++;
      for (let i = 0; i < n; i++) errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      const clean = s.replaceAll('\r', '');
      value += clean; added += clean.length; pos = len;
      uEnded = 2; uAdded = added; return value;
    }
  }

  while (true) {
    // Skip empty lines (LF or CRLF only).
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos++; line++; }
      else if (c === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) { pos += 2; line++; }
      else break;
    }
    if (pos >= len) break;

    const recordLine = line;
    const recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended;
    let quoted = false;
    do {
      if (text.charCodeAt(pos) === 34) {
        quoted = true;
        const open = pos;
        const openLine = line;
        let q = text.indexOf('"', pos + 1);
        let hasDoubled = false;
        while (q >= 0 && q + 1 < len && text.charCodeAt(q + 1) === 34) {
          hasDoubled = true;
          q = text.indexOf('"', q + 2);
        }
        if (q < 0) {
          // Never closes: literal quote, re-read rest as unquoted.
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          pos = open + 1; line = openLine;
          fields.push(unquoted('"', recordLine, recordRow)); ended = uEnded;
        } else {
          let value = text.slice(pos + 1, q);
          const hasCR = value.indexOf('\r') >= 0;
          if (hasDoubled || hasCR) {
            // Line breaks inside: LF +1, lone CR +1 (CRLF's LF
            // already counts once). Rare path, small scan is fine.
            let delta = 0;
            for (let i = 0; i < value.length; i++) {
              const cc = value.charCodeAt(i);
              if (cc === 10) delta++;
              else if (cc === 13 && (i + 1 >= value.length || value.charCodeAt(i + 1) !== 10)) delta++;
            }
            line += delta;
            if (hasDoubled) value = value.replaceAll('""', '"');
            if (hasCR) value = value.replace(/\r\n?/g, '\n');
          } else {
            let idx = value.indexOf('\n');
            if (idx >= 0) {
              let delta = 0;
              let p = idx;
              while (p >= 0) { delta++; p = value.indexOf('\n', p + 1); }
              line += delta;
            }
          }
          pos = q + 1;
          if (pos >= len) { fields.push(value); ended = 2; }
          else {
            const c = text.charCodeAt(pos);
            if (c === 44) { pos++; fields.push(value); ended = 0; }
            else if (c === 10) { pos++; line++; fields.push(value); ended = 1; }
            else if (c === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
              pos += 2; line++; fields.push(value); ended = 1;
            } else {
              const v = unquoted(value, recordLine, recordRow);
              if (uAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
              fields.push(v); ended = uEnded;
            }
          }
        }
      } else {
        quoted = false;
        fields.push(unquoted('', recordLine, recordRow)); ended = uEnded;
      }
    } while (ended === 0);

    // A line that held only stray CRs is left with no characters:
    // no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
