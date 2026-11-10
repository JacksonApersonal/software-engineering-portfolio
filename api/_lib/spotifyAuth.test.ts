import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import {
  clearSpotifySessionCookie,
  clearSpotifyStateCookie,
  createSpotifyAuthorizationUrl,
  decryptSpotifySession,
  encryptSpotifySession,
  ensureFreshSpotifySession,
  exchangeAuthorizationCode,
  generateOAuthState,
  loadSpotifyAuthConfig,
  OAUTH_STATE_MAX_AGE_SECONDS,
  readCookieValue,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  refreshSpotifySession,
  serializeSpotifySessionCookie,
  serializeSpotifyStateCookie,
  SPOTIFY_SCOPE,
  SPOTIFY_SESSION_COOKIE,
  SPOTIFY_STATE_COOKIE,
  SPOTIFY_TOKEN_URL,
  SpotifyAuthError,
  SpotifyReauthorizationRequiredError,
  verifyOAuthState,
  type SpotifyAuthConfig,
  type SpotifyFetch,
  type SpotifySession,
} from './spotifyAuth.js';

const NOW = Date.UTC(2026, 10, 9, 18, 0, 0);
const SESSION_SECRET = Buffer.alloc(32, 7).toString('base64url');

function createEnvironment(
  overrides: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  return {
    SPOTIFY_CLIENT_ID: 'client-id',
    SPOTIFY_CLIENT_SECRET: 'client-secret',
    SPOTIFY_REDIRECT_URI:
      'https://portfolio.example/api/spotify/callback',
    SPOTIFY_SESSION_SECRET: SESSION_SECRET,
    VERCEL_ENV: 'production',
    ...overrides,
  };
}

function createConfig(
  overrides: Partial<SpotifyAuthConfig> = {},
): SpotifyAuthConfig {
  return {
    ...loadSpotifyAuthConfig(createEnvironment()),
    ...overrides,
  };
}

function createSession(
  overrides: Partial<SpotifySession> = {},
): SpotifySession {
  return {
    version: 1,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    accessTokenExpiresAt: NOW + 60 * 60 * 1000,
    refreshTokenExpiresAt:
      NOW + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000,
    ...overrides,
  };
}

function tokenResponse(
  overrides: Record<string, unknown> = {},
): Response {
  return Response.json(
    {
      access_token: 'new-access-token',
      token_type: 'Bearer',
      scope: SPOTIFY_SCOPE,
      expires_in: 3600,
      refresh_token: 'new-refresh-token',
      ...overrides,
    },
    { status: 200 },
  );
}

describe('Spotify OAuth configuration and state', () => {
  it('loads HTTPS production configuration and a 32-byte session key', () => {
    const config = loadSpotifyAuthConfig(createEnvironment());

    expect(config).toMatchObject({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'https://portfolio.example/api/spotify/callback',
      secureCookies: true,
    });
    expect(config.sessionKey).toHaveLength(32);
  });

  it('supports local HTTP only on an explicit loopback address', () => {
    const config = loadSpotifyAuthConfig(
      createEnvironment({
        SPOTIFY_REDIRECT_URI:
          'http://127.0.0.1:3000/api/spotify/callback',
        VERCEL_ENV: 'development',
      }),
    );

    expect(config.secureCookies).toBe(false);
    expect(() =>
      loadSpotifyAuthConfig(
        createEnvironment({
          SPOTIFY_REDIRECT_URI:
            'http://localhost:3000/api/spotify/callback',
          VERCEL_ENV: 'development',
        }),
      ),
    ).toThrow(SpotifyAuthError);
    expect(() =>
      loadSpotifyAuthConfig(
        createEnvironment({
          SPOTIFY_REDIRECT_URI:
            'http://127.0.0.1:3000/api/spotify/callback',
          VERCEL_ENV: 'production',
        }),
      ),
    ).toThrow(SpotifyAuthError);
  });

  it('rejects missing, whitespace-padded, and malformed configuration', () => {
    expect(() =>
      loadSpotifyAuthConfig(
        createEnvironment({ SPOTIFY_CLIENT_SECRET: undefined }),
      ),
    ).toThrow(/SPOTIFY_CLIENT_SECRET/);
    expect(() =>
      loadSpotifyAuthConfig(
        createEnvironment({ SPOTIFY_CLIENT_ID: ' client-id' }),
      ),
    ).toThrow(/SPOTIFY_CLIENT_ID/);
    expect(() =>
      loadSpotifyAuthConfig(
        createEnvironment({ SPOTIFY_SESSION_SECRET: 'not-a-key' }),
      ),
    ).toThrow(/32 bytes/);
  });

  it('generates unpredictable-length state and verifies it safely', () => {
    const state = generateOAuthState((size) => Buffer.alloc(size, 9));

    expect(state).toHaveLength(43);
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateOAuthState()).not.toBe(generateOAuthState());
    expect(verifyOAuthState(state, state)).toBe(true);
    expect(verifyOAuthState(state, `${state}x`)).toBe(false);
    expect(verifyOAuthState(state, null)).toBe(false);
    expect(() => generateOAuthState(() => Buffer.alloc(31))).toThrow(
      /state source/,
    );
  });

  it('constructs an exact authorization URL with only user-top-read', () => {
    const config = createConfig();
    const url = new URL(createSpotifyAuthorizationUrl(config, 'oauth-state'));

    expect(url.origin + url.pathname).toBe(
      'https://accounts.spotify.com/authorize',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'client-id',
      scope: 'user-top-read',
      redirect_uri: 'https://portfolio.example/api/spotify/callback',
      state: 'oauth-state',
    });
  });
});

describe('Spotify token exchange and refresh', () => {
  it('exchanges an authorization code using server-side client credentials', async () => {
    const fetcher = vi.fn<SpotifyFetch>(async () => tokenResponse());
    const config = createConfig();

    const session = await exchangeAuthorizationCode('authorization-code', config, {
      fetcher,
      now: () => NOW,
    });

    expect(fetcher).toHaveBeenCalledOnce();
    const [input, init] = fetcher.mock.calls[0];
    expect(input).toBe(SPOTIFY_TOKEN_URL);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from(
        'client-id:client-secret',
      ).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect((init?.body as URLSearchParams).toString()).toBe(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'authorization-code',
        redirect_uri: 'https://portfolio.example/api/spotify/callback',
      }).toString(),
    );
    expect(session).toEqual({
      version: 1,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      accessTokenExpiresAt: NOW + 3_600_000,
      refreshTokenExpiresAt:
        NOW + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000,
    });
  });

  it('refreshes access tokens and preserves or rotates refresh tokens', async () => {
    const original = createSession();
    const preserveFetcher = vi.fn<SpotifyFetch>(async () =>
      tokenResponse({ refresh_token: undefined }),
    );
    const rotateFetcher = vi.fn<SpotifyFetch>(async () => tokenResponse());

    const preserved = await refreshSpotifySession(original, createConfig(), {
      fetcher: preserveFetcher,
      now: () => NOW + 10_000,
    });
    const rotated = await refreshSpotifySession(original, createConfig(), {
      fetcher: rotateFetcher,
      now: () => NOW + 20_000,
    });

    expect(preserved.refreshToken).toBe('refresh-token');
    expect(rotated.refreshToken).toBe('new-refresh-token');
    expect(preserved.refreshTokenExpiresAt).toBe(
      original.refreshTokenExpiresAt,
    );
    const [, init] = preserveFetcher.mock.calls[0];
    expect((init?.body as URLSearchParams).toString()).toBe(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: 'refresh-token',
      }).toString(),
    );
  });

  it('refreshes only when the access token is near expiration', async () => {
    const fetcher = vi.fn<SpotifyFetch>(async () => tokenResponse());
    const config = createConfig();
    const current = createSession({ accessTokenExpiresAt: NOW + 120_000 });
    const expiring = createSession({ accessTokenExpiresAt: NOW + 30_000 });

    await expect(
      ensureFreshSpotifySession(current, config, {
        fetcher,
        now: () => NOW,
      }),
    ).resolves.toBe(current);
    await expect(
      ensureFreshSpotifySession(expiring, config, {
        fetcher,
        now: () => NOW,
      }),
    ).resolves.toMatchObject({ accessToken: 'new-access-token' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('requires reauthorization for invalid_grant and expired refresh tokens', async () => {
    const invalidGrantFetcher = vi.fn<SpotifyFetch>(async () =>
      Response.json({ error: 'invalid_grant' }, { status: 400 }),
    );

    await expect(
      refreshSpotifySession(createSession(), createConfig(), {
        fetcher: invalidGrantFetcher,
        now: () => NOW,
      }),
    ).rejects.toBeInstanceOf(SpotifyReauthorizationRequiredError);

    const unusedFetcher = vi.fn();
    await expect(
      refreshSpotifySession(
        createSession({ refreshTokenExpiresAt: NOW }),
        createConfig(),
        { fetcher: unusedFetcher, now: () => NOW },
      ),
    ).rejects.toBeInstanceOf(SpotifyReauthorizationRequiredError);
    expect(unusedFetcher).not.toHaveBeenCalled();
  });

  it('rejects malformed successful responses without exposing their values', async () => {
    const fetcher = vi.fn<SpotifyFetch>(async () =>
      tokenResponse({ access_token: '', refresh_token: '' }),
    );

    await expect(
      exchangeAuthorizationCode('authorization-code', createConfig(), {
        fetcher,
      }),
    ).rejects.toMatchObject({ code: 'invalid_token_response' });
  });
});

describe('Spotify encrypted sessions and cookies', () => {
  it('round-trips a versioned session with authenticated encryption', () => {
    const session = createSession();
    const key = createConfig().sessionKey;
    const encrypted = encryptSpotifySession(
      session,
      key,
      (size) => Buffer.alloc(size, 3),
    );

    expect(encrypted).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encrypted).not.toContain(session.accessToken);
    expect(encrypted).not.toContain(session.refreshToken);
    expect(decryptSpotifySession(encrypted, key, NOW)).toEqual(session);
  });

  it('rejects tampered, malformed, wrong-key, and expired sessions', () => {
    const session = createSession();
    const key = createConfig().sessionKey;
    const encrypted = encryptSpotifySession(session, key);
    const parts = encrypted.split('.');
    const authenticationTag = parts[3] as string;
    parts[3] = `${authenticationTag.startsWith('A') ? 'B' : 'A'}${authenticationTag.slice(1)}`;
    const tampered = parts.join('.');

    expect(decryptSpotifySession(tampered, key, NOW)).toBeNull();
    expect(decryptSpotifySession('not-a-session', key, NOW)).toBeNull();
    expect(decryptSpotifySession(encrypted, Buffer.alloc(32, 1), NOW)).toBeNull();
    expect(
      decryptSpotifySession(encrypted, key, session.refreshTokenExpiresAt),
    ).toBeNull();
  });

  it('serializes secure production cookies and parses their values', () => {
    const config = createConfig();
    const session = createSession();
    const encrypted = encryptSpotifySession(session, config.sessionKey);
    const stateCookie = serializeSpotifyStateCookie('oauth-state', config, NOW);
    const sessionCookie = serializeSpotifySessionCookie(
      encrypted,
      session,
      config,
      NOW,
    );

    for (const cookie of [stateCookie, sessionCookie]) {
      expect(cookie).toContain('Path=/api/spotify');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Secure');
    }
    expect(stateCookie).toContain(
      `Max-Age=${OAUTH_STATE_MAX_AGE_SECONDS}`,
    );
    expect(readCookieValue(stateCookie, SPOTIFY_STATE_COOKIE)).toBe(
      'oauth-state',
    );
    expect(readCookieValue(sessionCookie, SPOTIFY_SESSION_COOKIE)).toBe(
      encrypted,
    );
    expect(Buffer.byteLength(sessionCookie, 'utf8')).toBeLessThan(4096);
  });

  it('omits Secure only for validated loopback development and clears cookies', () => {
    const localConfig = loadSpotifyAuthConfig(
      createEnvironment({
        SPOTIFY_REDIRECT_URI:
          'http://127.0.0.1:3000/api/spotify/callback',
        VERCEL_ENV: 'development',
      }),
    );

    expect(
      serializeSpotifyStateCookie('oauth-state', localConfig, NOW),
    ).not.toContain('Secure');
    expect(clearSpotifyStateCookie(localConfig, NOW)).toContain('Max-Age=0');
    expect(clearSpotifySessionCookie(localConfig, NOW)).toContain('Max-Age=0');
  });

  it('rejects cookie values that exceed browser cookie limits', () => {
    const config = createConfig();
    const session = createSession({
      accessToken: 'a'.repeat(3000),
      refreshToken: 'r'.repeat(3000),
    });
    const encrypted = encryptSpotifySession(session, config.sessionKey);

    expect(() =>
      serializeSpotifySessionCookie(encrypted, session, config, NOW),
    ).toThrow(/too large/);
  });
});
