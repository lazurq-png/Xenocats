// CSV for spreadsheets. Two things make a cell safe to open in Excel, Numbers or
// Sheets: text a spreadsheet could take for a formula is prefixed with an
// apostrophe, so it is shown, never run (CSV "formula injection"); and a cell with
// a quote, comma, line break or edge space is quoted, with its quotes doubled
// (RFC 4180). Numbers are written as they are.
//
// "Could take for a formula": it starts with = + - @ (or their full-width forms,
// which some locales accept), possibly after spaces or control characters an
// importer may trim, or it starts with a tab, carriage return or line feed.

const LOOKS_LIKE_A_FORMULA = /^[\s\u0000-\u001f]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]|^[\t\r\n]/;
const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;

/** One cell, safe to open in a spreadsheet. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && LOOKS_LIKE_A_FORMULA.test(text)) text = `'${text}`;
  if (NEEDS_QUOTES.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Rows of cells as CSV text, each line ending in CRLF. */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return rows.map((row) => row.map(csvCell).join(',') + '\r\n').join('');
}
