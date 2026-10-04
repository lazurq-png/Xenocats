import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '@/app/lib/csv';

describe('csvCell', () => {
  it('leaves plain text and numbers alone', () => {
    expect(csvCell('Evil Rabbit')).toBe('Evil Rabbit');
    expect(csvCell('a-b+c@d.example')).toBe('a-b+c@d.example');
    expect(csvCell('2023-06-27')).toBe('2023-06-27');
    expect(csvCell('666.00')).toBe('666.00');
    expect(csvCell(42)).toBe('42');
  });

  it('defuses text a spreadsheet would run as a formula', () => {
    for (const formula of [
      '=HYPERLINK("http://evil.example","click")',
      '+1+1',
      '-2+3',
      '@SUM(A1:A2)',
      '\t=1+1',
      '\r=1+1',
    ]) {
      const cell = csvCell(formula);
      // Shown as text: starts with an apostrophe (inside quotes if quoting was needed).
      expect(cell.replace(/^"/, '').startsWith("'")).toBe(true);
    }
    expect(csvCell('=1+1')).toBe("'=1+1");
  });

  it('also when the formula hides behind spaces, control characters or a line feed', () => {
    for (const hidden of [
      ' =1+1',
      '  @SUM(A1)',
      '\n=1+1',
      '\u0000=1+1',
      '\n',
      '\uFF1D1+1', // full-width =
    ]) {
      expect(csvCell(hidden).replace(/^"/, '').startsWith("'"), JSON.stringify(hidden)).toBe(true);
    }
  });

  it('quotes cells with commas, quotes, line breaks or edge spaces, doubling quotes', () => {
    expect(csvCell('Acme, Inc.')).toBe('"Acme, Inc."');
    expect(csvCell('the "best"')).toBe('"the ""best"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(' padded ')).toBe('" padded "');
  });

  it('does both for a formula with a comma', () => {
    expect(csvCell('=SUM(1,2)')).toBe(`"'=SUM(1,2)"`);
  });
});

describe('toCsv', () => {
  it('joins cells with commas and rows with CRLF', () => {
    expect(
      toCsv([
        ['Customer', 'Amount'],
        ['Acme, Inc.', '1.50'],
        ['=evil', '2.00'],
      ])
    ).toBe(`Customer,Amount\r\n"Acme, Inc.",1.50\r\n'=evil,2.00\r\n`);
  });
});
