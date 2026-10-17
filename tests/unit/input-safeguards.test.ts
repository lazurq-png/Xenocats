import { describe, expect, it } from 'vitest';
import {
  CreateInvoice,
  CustomerForm,
  LeaderboardName,
  SEARCH_MAX_LENGTH,
  containsPattern,
  isPlainText,
} from '@/app/lib/schemas';
import {
  addressBlock,
  clientAddress,
  clientKey,
  signUpLimit,
  trustedProxyHeader,
} from '@/app/lib/sign-up-limit';

// The rules typed input is held to before it reaches the database or another
// person's screen (app/lib/schemas.ts, app/lib/sign-up-limit.ts).

describe('isPlainText', () => {
  it('refuses characters nobody sees, or that turn the text around', () => {
    for (const text of ['a\u0000b', 'a\u0007b', 'a​b', '‮gnirts', 'a b', 'a﻿b']) {
      expect(isPlainText(text), JSON.stringify(text)).toBe(false);
    }
  });

  it('takes ordinary text in any language', () => {
    for (const text of ['Evil Rabbit', 'Zoë Ålund', 'Ольга', '王小明', 'O’Brien & Sons']) {
      expect(isPlainText(text), text).toBe(true);
    }
  });
});

describe('LeaderboardName', () => {
  it('trims, makes runs of spaces one, and takes letters of any language', () => {
    expect(LeaderboardName.parse('  Comet   Tail ')).toBe('Comet Tail');
    expect(LeaderboardName.parse('Zoë_2.0')).toBe('Zoë_2.0');
    expect(LeaderboardName.parse("O'Neil-Kat")).toBe("O'Neil-Kat");
    expect(LeaderboardName.parse('王小明')).toBe('王小明');
    // Accents a real name has: composed by NFC, or a few marks on one letter.
    // (Code points, so the marks can be read: mark(0x301) is a combining acute.)
    const mark = (...codes: number[]) => String.fromCodePoint(...codes);
    expect(LeaderboardName.parse('Nguy' + mark(0x1ec5) + 'n')).toBe('Nguy' + mark(0x1ec5) + 'n');
    expect(LeaderboardName.parse('Zoe' + mark(0x308))).toBe('Zo' + mark(0xeb));
    // NFC puts the dot below before the dot above.
    expect(LeaderboardName.parse('q' + mark(0x307, 0x323))).toBe('q' + mark(0x323, 0x307));
    expect(LeaderboardName.parse('हिन्दी')).toBe('हिन्दी');
    // Burmese puts four or five marks on a letter, most of them spacing (Mc), which do
    // not pile up: 'nine', Kyaw, Myo, and Myo the city.
    for (const name of [
      mark(0x1000, 0x102d, 0x102f, 0x1038),
      mark(0x1000, 0x103b, 0x1031, 0x102c, 0x103a),
      mark(0x1019, 0x103b, 0x102d, 0x102f, 0x1038),
      mark(0x1019, 0x103c, 0x102d, 0x102f, 0x1037),
    ]) {
      expect(LeaderboardName.parse(name)).toBe(name);
    }
  });

  it('refuses accents stacked into a tower, or with no letter to carry them', () => {
    const mark = (...codes: number[]) => String.fromCodePoint(...codes);
    const refused = (name: string) => {
      const result = LeaderboardName.safeParse(name);
      expect(result.success, JSON.stringify(name)).toBe(false);
      return result.error?.issues[0].message;
    };
    for (const name of [
      'a' + mark(0x301).repeat(19),
      'Comet' + mark(0x301, 0x302, 0x303, 0x304),
      // Enclosing marks (the Cyrillic millions sign) count too.
      'a' + mark(0x489).repeat(19),
    ]) {
      expect(refused(name)).toBe('A letter can carry at most three accents.');
    }
    for (const name of [mark(0x301) + 'Comet', 'Comet ' + mark(0x301)]) {
      expect(refused(name)).toBe('An accent must be on a letter.');
    }
  });

  it('refuses markup, hidden characters, empty and over-long names', () => {
    for (const name of [
      '<script>',
      'a&b',
      '‮gnirts',
      'a​b',
      'admin\u0000',
      '   ',
      'x'.repeat(21),
      '🐱',
      'https://x.y',
      42,
    ]) {
      expect(LeaderboardName.safeParse(name).success, JSON.stringify(name)).toBe(false);
    }
  });
});

describe('CustomerForm', () => {
  it('refuses a name with hidden characters', () => {
    const result = CustomerForm.safeParse({ name: 'Evil‮ Rabbit', email: 'evil@rabbit.com' });
    expect(result.error?.flatten().fieldErrors.name).toEqual([
      'A name cannot contain invisible or control characters.',
    ]);
  });
});

describe('an invoice amount', () => {
  const amount = (value: string) =>
    CreateInvoice.safeParse({
      customerId: 'c',
      amount: value,
      status: 'paid',
      dueDate: '2030-01-01',
    }).error?.flatten().fieldErrors.amount;

  it('is at least one cent once rounded, and at most $1,000,000', () => {
    expect(amount('0.01')).toBeUndefined();
    expect(amount('1000000')).toBeUndefined();
    expect(amount('0.004')).toEqual(['Please enter an amount of at least $0.01.']);
    expect(amount('1000000.01')).toEqual(['An amount can be at most $1,000,000.']);
    expect(amount('1e309')).toEqual(['An amount can be at most $1,000,000.']);
  });
});

describe('containsPattern', () => {
  it('matches %, _ and \\ as themselves', () => {
    expect(containsPattern('50%_off\\')).toBe('%50\\%\\_off\\\\%');
  });

  it(`ignores anything past ${SEARCH_MAX_LENGTH} characters, and anything that is not text`, () => {
    expect(containsPattern('a'.repeat(SEARCH_MAX_LENGTH + 50))).toBe(
      `%${'a'.repeat(SEARCH_MAX_LENGTH)}%`
    );
    expect(containsPattern(undefined)).toBe('%%');
    expect(containsPattern(['a', 'b'])).toBe('%a,b%');
  });
});

describe('the sign-up limit', () => {
  it('is 2 a day unless the environment says another whole number', () => {
    expect(signUpLimit({})).toBe(2);
    expect(signUpLimit({ SIGNUP_MAX_PER_DAY: '5' })).toBe(5);
    expect(signUpLimit({ SIGNUP_MAX_PER_DAY: '-1' })).toBe(2);
    expect(signUpLimit({ SIGNUP_MAX_PER_DAY: 'lots' })).toBe(2);
  });

  it('believes a proxy header only where the deployment says a proxy sets it', () => {
    expect(trustedProxyHeader({})).toBeNull();
    expect(trustedProxyHeader({ VERCEL: '1' })).toBe('x-real-ip');
    expect(trustedProxyHeader({ TRUSTED_PROXY_HEADER: 'X-Forwarded-For' })).toBe('x-forwarded-for');
    expect(trustedProxyHeader({ TRUSTED_PROXY_HEADER: 'x-client-ip' })).toBeNull();
  });

  it('with no trusted proxy, ignores what the client wrote: every client shares one count', () => {
    const spoofed = new Headers({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.2.3.4' });
    expect(clientAddress(spoofed, null)).toBe('unknown');
  });

  it('takes the address the trusted proxy saw', () => {
    const headers = new Headers({
      'x-real-ip': '203.0.113.7',
      // The client can put anything first; the proxy appends what it saw.
      'x-forwarded-for': '1.2.3.4, 198.51.100.9',
    });
    expect(clientAddress(headers, 'x-real-ip')).toBe('203.0.113.7');
    expect(clientAddress(headers, 'x-forwarded-for')).toBe('198.51.100.9');
    expect(clientAddress(new Headers(), 'x-real-ip')).toBe('unknown');
  });

  it('counts an IPv6 address by its /64, and an IPv4 one by itself', () => {
    expect(addressBlock('2001:db8:85a3:42:1:2:3:4')).toBe('2001:db8:85a3:42::/64');
    expect(addressBlock('2001:DB8:85a3:0042::ffff')).toBe('2001:db8:85a3:42::/64');
    expect(addressBlock('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(addressBlock('::1')).toBe('0:0:0:0::/64');
    expect(addressBlock('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(addressBlock('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(addressBlock('203.0.113.7')).toBe('203.0.113.7');
    // Two addresses of one /64 are one count.
    expect(clientKey('2001:db8:1:2::a', 's')).toBe(clientKey('2001:db8:1:2:ffff::b', 's'));
    expect(clientKey('2001:db8:1:2::a', 's')).not.toBe(clientKey('2001:db8:1:3::a', 's'));
  });

  it('keys an address by a hash made with the secret, not the address', () => {
    const key = clientKey('203.0.113.7', 'secret');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).toBe(clientKey('203.0.113.7', 'secret'));
    expect(key).not.toBe(clientKey('203.0.113.7', 'another secret'));
    expect(key).not.toBe(clientKey('203.0.113.8', 'secret'));
  });
});
