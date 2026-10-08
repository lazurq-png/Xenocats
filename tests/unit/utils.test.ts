import { describe, expect, it } from 'vitest';
import {
  dueText,
  formatCurrency,
  formatDateToLocal,
  generatePagination,
  parsePage,
} from '@/app/lib/utils';

describe('formatCurrency', () => {
  it('formats cents as US dollars', () => {
    expect(formatCurrency(12345)).toBe('$123.45');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(100000)).toBe('$1,000.00');
  });
});

describe('formatDateToLocal', () => {
  it('formats an ISO date in en-US by default', () => {
    expect(formatDateToLocal('2023-06-05')).toBe('Jun 5, 2023');
  });

  it('accepts another locale', () => {
    expect(formatDateToLocal('2023-06-05', 'en-GB')).toBe('5 Jun 2023');
  });
});

describe('generatePagination', () => {
  it('lists every page when there are 7 or fewer', () => {
    expect(generatePagination(1, 0)).toEqual([]);
    expect(generatePagination(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(generatePagination(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('near the start shows the first three and the last two', () => {
    expect(generatePagination(1, 10)).toEqual([1, 2, 3, '...', 9, 10]);
    expect(generatePagination(3, 10)).toEqual([1, 2, 3, '...', 9, 10]);
  });

  it('near the end shows the first two and the last three', () => {
    expect(generatePagination(8, 10)).toEqual([1, 2, '...', 8, 9, 10]);
    expect(generatePagination(10, 10)).toEqual([1, 2, '...', 8, 9, 10]);
  });

  it('in the middle shows the current page with its neighbours', () => {
    expect(generatePagination(5, 10)).toEqual([1, '...', 4, 5, 6, '...', 10]);
  });
});

describe('parsePage', () => {
  it('takes a whole page number from 1 up', () => {
    expect(parsePage('1')).toBe(1);
    expect(parsePage('3')).toBe(3);
  });

  it('reads anything else as page 1, never a negative or fractional page', () => {
    for (const value of [null, undefined, '', '0', '-1', '-0', '2.5', 'abc', '1e400', 'Infinity']) {
      expect(parsePage(value), String(value)).toBe(1);
    }
  });
});

describe('dueText', () => {
  it('says how near the due date is, in whole days', () => {
    expect(dueText(0)).toBe('Due today');
    expect(dueText(1)).toBe('Due in 1 day');
    expect(dueText(30)).toBe('Due in 30 days');
    expect(dueText(-1)).toBe('Overdue by 1 day');
    expect(dueText(-365)).toBe('Overdue by 365 days');
  });
});
