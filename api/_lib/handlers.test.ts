import { describe, expect, it } from 'vitest';
import type {
  ShortLinkStore,
  StoredShortLink,
} from '../../src/lib/urlShortener';
import {
  createRedirectHandler,
  createShortenHandler,
  type CreationRateLimiter,
} from './handlers';

class FakeShortLinkStore implements ShortLinkStore {
  readonly links = new Map<string, StoredShortLink>();
  reserveCalls = 0;
  collisionsRemaining = 0;
  failReads = false;
  failWrites = false;

  async reserveIfAbsent(
    code: string,
    link: StoredShortLink,
  ): Promise<boolean> {
    this.reserveCalls += 1;

    if (this.failWrites) {
      throw new Error('Redis credentials must not leak.');
    }

    if (this.collisionsRemaining > 0) {
      this.collisionsRemaining -= 1;
      return false;
    }

    if (this.links.has(code)) {
      return false;
    }

    this.links.set(code, link);
    return true;
  }

  async get(code: string): Promise<StoredShortLink | null> {
    if (this.failReads) {
      throw new Error('Redis credentials must not leak.');
    }

    return this.links.get(code) ?? null;
  }
}

class FakeRateLimiter implements CreationRateLimiter {
  consumeCalls = 0;
  isAllowed = true;
  shouldFail = false;

  async consume(): Promise<boolean> {
    this.consumeCalls += 1;

    if (this.shouldFail) {
      throw new Error('Redis credentials must not leak.');
    }

    return this.isAllowed;
  }
}

function createCreationHandler(
  store = new FakeShortLinkStore(),
  rateLimiter = new FakeRateLimiter(),
) {
  return {
    store,
    rateLimiter,
    handler: createShortenHandler({
      store,
      rateLimiter,
      publicOrigin: 'https://portfolio.example',
      getClientIdentifier: () => 'test-client',
    }),
  };
}

function createJsonRequest(
  body: string,
  method = 'POST',
  url = 'https://untrusted-host.example/api/shorten',
): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  });
}

describe('POST /api/shorten', () => {
  it('creates and stores a short link using the trusted configured origin', async () => {
    const { handler, store, rateLimiter } = createCreationHandler();

    const response = await handler(
      createJsonRequest(JSON.stringify({ url: 'https://Example.com/path' })),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      destination: 'https://example.com/path',
    });
    expect(body.code).toMatch(/^[0-9A-Za-z]{8}$/);
    expect(body.shortUrl).toBe(`https://portfolio.example/s/${body.code}`);
    await expect(store.get(body.code)).resolves.toMatchObject({
      destination: 'https://example.com/path',
      createdAt: body.createdAt,
    });
    expect(rateLimiter.consumeCalls).toBe(1);
  });

  it('allows the domain layer to retry a storage collision', async () => {
    const store = new FakeShortLinkStore();
    store.collisionsRemaining = 1;
    const { handler } = createCreationHandler(store);

    const response = await handler(
      createJsonRequest(JSON.stringify({ url: 'https://example.com' })),
    );

    expect(response.status).toBe(201);
    expect(store.reserveCalls).toBe(2);
    expect(store.links.size).toBe(1);
  });

  it.each([
    ['invalid JSON', '{', /valid JSON/],
    ['missing URL', JSON.stringify({ destination: 'https://example.com' }), /URL string/],
    ['invalid URL', JSON.stringify({ url: 'not a URL' }), /malformed/],
  ])('returns 400 for %s', async (_case, requestBody, expectedError) => {
    const { handler } = createCreationHandler();

    const response = await handler(createJsonRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.error).toMatch(expectedError);
  });

  it('rejects oversized request bodies', async () => {
    const { handler } = createCreationHandler();
    const requestBody = JSON.stringify({ url: `https://example.com/${'a'.repeat(5000)}` });

    const response = await handler(createJsonRequest(requestBody));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'The request body is too large.',
    });
  });

  it('enforces POST-only creation', async () => {
    const { handler, rateLimiter } = createCreationHandler();

    const response = await handler(createJsonRequest('', 'GET'));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(rateLimiter.consumeCalls).toBe(0);
  });

  it('returns 429 when the creation limit is exhausted', async () => {
    const rateLimiter = new FakeRateLimiter();
    rateLimiter.isAllowed = false;
    const { handler, store } = createCreationHandler(
      new FakeShortLinkStore(),
      rateLimiter,
    );

    const response = await handler(
      createJsonRequest(JSON.stringify({ url: 'https://example.com' })),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(store.reserveCalls).toBe(0);
  });

  it.each(['rate limit', 'link storage'])('returns 503 for a %s failure', async (failure) => {
    const store = new FakeShortLinkStore();
    const rateLimiter = new FakeRateLimiter();
    store.failWrites = failure === 'link storage';
    rateLimiter.shouldFail = failure === 'rate limit';
    const { handler } = createCreationHandler(store, rateLimiter);

    const response = await handler(
      createJsonRequest(JSON.stringify({ url: 'https://example.com' })),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.error).not.toContain('Redis');
  });
});

describe('GET and HEAD /s/:code', () => {
  it('temporarily redirects a valid stored code', async () => {
    const store = new FakeShortLinkStore();
    store.links.set('Ab3x91Qz', {
      destination: 'https://example.com/path',
      createdAt: '2026-11-08T18:00:00.000Z',
    });
    const handler = createRedirectHandler({ store });

    const response = await handler(
      new Request('https://portfolio.example/api/redirect?code=Ab3x91Qz'),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://example.com/path');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('');
  });

  it('returns 404 for an unknown code', async () => {
    const handler = createRedirectHandler({ store: new FakeShortLinkStore() });

    const response = await handler(
      new Request('https://portfolio.example/api/redirect?code=Ab3x91Qz'),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects malformed short codes without querying storage', async () => {
    const store = new FakeShortLinkStore();
    store.failReads = true;
    const handler = createRedirectHandler({ store });

    const response = await handler(
      new Request('https://portfolio.example/api/redirect?code=invalid!'),
    );

    expect(response.status).toBe(400);
  });

  it('enforces GET and HEAD methods', async () => {
    const handler = createRedirectHandler({ store: new FakeShortLinkStore() });

    const response = await handler(
      new Request('https://portfolio.example/api/redirect?code=Ab3x91Qz', {
        method: 'POST',
      }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, HEAD');
  });

  it('supports bodyless HEAD redirects and HEAD errors', async () => {
    const store = new FakeShortLinkStore();
    store.links.set('Ab3x91Qz', {
      destination: 'https://example.com/',
      createdAt: '2026-11-08T18:00:00.000Z',
    });
    const handler = createRedirectHandler({ store });

    const redirectResponse = await handler(
      new Request('https://portfolio.example/api/redirect?code=Ab3x91Qz', {
        method: 'HEAD',
      }),
    );
    const missingResponse = await handler(
      new Request('https://portfolio.example/api/redirect?code=Zz9Yy8Xx', {
        method: 'HEAD',
      }),
    );

    expect(redirectResponse.status).toBe(302);
    expect(redirectResponse.headers.get('location')).toBe('https://example.com/');
    expect(await redirectResponse.text()).toBe('');
    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.text()).toBe('');
  });

  it('returns 503 without leaking storage errors', async () => {
    const store = new FakeShortLinkStore();
    store.failReads = true;
    const handler = createRedirectHandler({ store });

    const response = await handler(
      new Request('https://portfolio.example/api/redirect?code=Ab3x91Qz'),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).not.toContain('Redis');
  });
});
