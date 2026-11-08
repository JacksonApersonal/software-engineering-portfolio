import { describe, expect, it, vi } from 'vitest';
import {
  getDestinationValidationError,
  requestShortUrl,
} from './urlShortenerClient';

describe('URL shortener client validation', () => {
  it.each([
    ['', 'Enter a destination URL.'],
    ['not a URL', 'Enter a valid HTTP or HTTPS URL.'],
    ['ftp://example.com/file', 'Enter a URL that starts with http:// or https://.'],
  ])('rejects %s before submission', (destination, expectedError) => {
    expect(getDestinationValidationError(destination)).toBe(expectedError);
  });

  it('accepts HTTP and HTTPS destinations for server validation', () => {
    expect(getDestinationValidationError('https://example.com/path')).toBeNull();
    expect(getDestinationValidationError('http://example.com')).toBeNull();
  });
});

describe('URL shortener API client', () => {
  it('submits the real API contract and returns a valid creation response', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'Ab3x91Qz',
          shortUrl: 'https://portfolio.example/s/Ab3x91Qz',
          destination: 'https://example.com/',
          createdAt: '2026-11-08T18:00:00.000Z',
        }),
        { status: 201 },
      ),
    );

    await expect(requestShortUrl('https://example.com', fetcher)).resolves.toEqual({
      code: 'Ab3x91Qz',
      shortUrl: 'https://portfolio.example/s/Ab3x91Qz',
      destination: 'https://example.com/',
      createdAt: '2026-11-08T18:00:00.000Z',
    });
    expect(fetcher).toHaveBeenCalledWith('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
  });

  it('preserves safe server validation messages', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Local destination hostnames are not allowed.' }), {
        status: 400,
      }),
    );

    await expect(requestShortUrl('http://localhost', fetcher)).rejects.toMatchObject({
      kind: 'validation',
      message: 'Local destination hostnames are not allowed.',
    });
  });

  it('maps rate limits to a clear user-facing error', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many requests.' }), {
        status: 429,
      }),
    );

    await expect(requestShortUrl('https://example.com', fetcher)).rejects.toMatchObject({
      kind: 'rate-limit',
      message: expect.stringContaining('try again later'),
    });
  });

  it.each([
    ['backend failure', () => Promise.resolve(new Response(null, { status: 503 }))],
    ['network failure', () => Promise.reject(new Error('offline'))],
    [
      'invalid success payload',
      () =>
        Promise.resolve(
          new Response(JSON.stringify({ shortUrl: 'javascript:alert(1)' }), {
            status: 201,
          }),
        ),
    ],
  ])('maps %s to backend unavailable', async (_case, fetcher) => {
    await expect(
      requestShortUrl('https://example.com', fetcher),
    ).rejects.toMatchObject({
      kind: 'unavailable',
      message: expect.stringContaining('temporarily unavailable'),
    });
  });
});
