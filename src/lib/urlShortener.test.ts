import { describe, expect, it } from 'vitest';
import {
  createShortLink,
  generateShortCode,
  MAX_URL_LENGTH,
  ShortCodeReservationError,
  type ShortLinkStore,
  type StoredShortLink,
  validateAndNormalizeUrl,
} from './urlShortener';

class InMemoryShortLinkStore implements ShortLinkStore {
  private readonly links = new Map<string, StoredShortLink>();

  constructor(initialLinks: Record<string, StoredShortLink> = {}) {
    Object.entries(initialLinks).forEach(([code, link]) => {
      this.links.set(code, link);
    });
  }

  async reserveIfAbsent(
    code: string,
    link: StoredShortLink,
  ): Promise<boolean> {
    if (this.links.has(code)) {
      return false;
    }

    this.links.set(code, link);
    return true;
  }

  async get(code: string): Promise<StoredShortLink | null> {
    return this.links.get(code) ?? null;
  }
}

describe('URL validation and normalization', () => {
  it('normalizes valid HTTP and HTTPS destinations', () => {
    expect(
      validateAndNormalizeUrl('  HTTPS://Example.COM:443/path?q=1#section  '),
    ).toBe('https://example.com/path?q=1#section');
    expect(validateAndNormalizeUrl('http://example.com:8080')).toBe(
      'http://example.com:8080/',
    );
    expect(validateAndNormalizeUrl('https://8.8.8.8/dns-query')).toBe(
      'https://8.8.8.8/dns-query',
    );
  });

  it.each([
    ['', 'required'],
    ['not a URL', 'malformed'],
    ['ftp://example.com/file', 'Only HTTP and HTTPS'],
    ['https://user:password@example.com', 'embedded credentials'],
    ['http://localhost', 'Local destination'],
    ['http://service.local', 'Local destination'],
    ['http://intranet', 'Local destination'],
    ['http://127.0.0.1', 'Private or loopback'],
    ['http://10.20.30.40', 'Private or loopback'],
    ['http://172.16.0.1', 'Private or loopback'],
    ['http://192.168.1.1', 'Private or loopback'],
    ['http://169.254.1.1', 'Private or loopback'],
    ['http://[::1]', 'Private or loopback'],
    ['http://[fc00::1]', 'Private or loopback'],
    ['http://[fe80::1]', 'Private or loopback'],
  ])('rejects %s', (destination, expectedMessage) => {
    expect(() => validateAndNormalizeUrl(destination)).toThrowError(
      new RegExp(expectedMessage, 'i'),
    );
  });

  it('rejects excessively long destinations', () => {
    const destination = `https://example.com/${'a'.repeat(MAX_URL_LENGTH)}`;

    expect(() => validateAndNormalizeUrl(destination)).toThrowError(
      /too long/,
    );
  });
});

describe('short-code generation', () => {
  it('generates eight-character Base62 codes', () => {
    const codes = Array.from({ length: 100 }, () => generateShortCode());

    codes.forEach((code) => {
      expect(code).toMatch(/^[0-9A-Za-z]{8}$/);
    });
  });
});

describe('short-link creation', () => {
  it('stores normalized destinations with creation metadata', async () => {
    const store = new InMemoryShortLinkStore();
    const createdAt = new Date('2026-11-08T18:00:00.000Z');

    const result = await createShortLink('https://EXAMPLE.com', store, {
      generateCode: () => 'Ab3x91Qz',
      now: () => createdAt,
    });

    expect(result).toEqual({
      code: 'Ab3x91Qz',
      link: {
        destination: 'https://example.com/',
        createdAt: createdAt.toISOString(),
      },
    });
    await expect(store.get('Ab3x91Qz')).resolves.toEqual(result.link);
  });

  it('retries collisions without overwriting the existing link', async () => {
    const existingLink: StoredShortLink = {
      destination: 'https://existing.example/',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const store = new InMemoryShortLinkStore({ AAAAAAAA: existingLink });
    const codes = ['AAAAAAAA', 'BBBBBBBB'];

    const result = await createShortLink('https://new.example', store, {
      generateCode: () => codes.shift() ?? 'CCCCCCCC',
      now: () => new Date('2026-11-08T18:00:00.000Z'),
    });

    expect(result.code).toBe('BBBBBBBB');
    await expect(store.get('AAAAAAAA')).resolves.toEqual(existingLink);
    await expect(store.get('BBBBBBBB')).resolves.toEqual(result.link);
  });

  it('fails after the bounded collision retry count is exhausted', async () => {
    const existingLink: StoredShortLink = {
      destination: 'https://existing.example/',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const store = new InMemoryShortLinkStore({ AAAAAAAA: existingLink });
    let attempts = 0;

    await expect(
      createShortLink('https://new.example', store, {
        generateCode: () => {
          attempts += 1;
          return 'AAAAAAAA';
        },
        maxAttempts: 3,
      }),
    ).rejects.toBeInstanceOf(ShortCodeReservationError);

    expect(attempts).toBe(3);
    await expect(store.get('AAAAAAAA')).resolves.toEqual(existingLink);
  });
});
