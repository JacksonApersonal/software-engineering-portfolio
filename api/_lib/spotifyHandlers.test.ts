import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import {
  createSpotifyCallbackHandler,
  createSpotifyDashboardHandler,
  createSpotifyLoginHandler,
  createSpotifyLogoutHandler,
  SPOTIFY_PROJECT_PATH,
  type SpotifyTimeRange,
} from './spotifyHandlers.js';
import {
  decryptSpotifySession,
  encryptSpotifySession,
  loadSpotifyAuthConfig,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  SPOTIFY_SCOPE,
  SPOTIFY_SESSION_COOKIE,
  SPOTIFY_STATE_COOKIE,
  SPOTIFY_TOKEN_URL,
  type SpotifyAuthConfig,
  type SpotifyFetch,
  type SpotifySession,
} from './spotifyAuth.js';

const NOW = Date.UTC(2026, 10, 9, 20, 0, 0);
const ORIGIN = 'https://portfolio.example';

function createConfig(): SpotifyAuthConfig {
  return loadSpotifyAuthConfig({
    SPOTIFY_CLIENT_ID: 'client-id',
    SPOTIFY_CLIENT_SECRET: 'client-secret',
    SPOTIFY_REDIRECT_URI: `${ORIGIN}/api/spotify/callback`,
    SPOTIFY_SESSION_SECRET: Buffer.alloc(32, 4).toString('base64url'),
    VERCEL_ENV: 'production',
  });
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

function createSessionCookie(
  config: SpotifyAuthConfig,
  session: SpotifySession = createSession(),
): string {
  return `${SPOTIFY_SESSION_COOKIE}=${encryptSpotifySession(
    session,
    config.sessionKey,
    (size) => Buffer.alloc(size, 3),
  )}`;
}

function tokenResponse(
  overrides: Record<string, unknown> = {},
): Response {
  return Response.json({
    access_token: 'refreshed-access-token',
    token_type: 'Bearer',
    scope: SPOTIFY_SCOPE,
    expires_in: 3600,
    refresh_token: 'rotated-refresh-token',
    ...overrides,
  });
}

function artistPayload(): object {
  return {
    items: [
      {
        name: 'Artist One',
        images: [
          {
            url: 'https://i.scdn.co/image/artist-one',
            width: 640,
            height: 640,
          },
        ],
        external_urls: {
          spotify: 'https://open.spotify.com/artist/artist-one',
        },
        popularity: 99,
      },
    ],
    href: 'raw-field-that-must-not-be-forwarded',
  };
}

function trackPayload(): object {
  return {
    items: [
      {
        name: 'Track One',
        external_urls: {
          spotify: 'https://open.spotify.com/track/track-one',
        },
        album: {
          name: 'Album One',
          images: [
            {
              url: 'https://i.scdn.co/image/album-one',
              width: 640,
              height: 640,
            },
          ],
        },
        artists: [
          {
            name: 'Artist One',
            external_urls: {
              spotify: 'https://open.spotify.com/artist/artist-one',
            },
          },
        ],
        uri: 'raw-field-that-must-not-be-forwarded',
      },
    ],
  };
}

function dashboardFetcher(
  overrides: {
    artists?: Response;
    tracks?: Response;
  } = {},
): ReturnType<typeof vi.fn<SpotifyFetch>> {
  return vi.fn<SpotifyFetch>(async (input) => {
    const url = String(input);

    if (url.includes('/me/top/artists')) {
      return overrides.artists ?? Response.json(artistPayload());
    }

    if (url.includes('/me/top/tracks')) {
      return overrides.tracks ?? Response.json(trackPayload());
    }

    throw new Error('Unexpected request.');
  });
}

function readSetCookie(response: Response): string {
  return response.headers.get('set-cookie') ?? '';
}

function extractCookieValue(setCookie: string, name: string): string | null {
  const match = setCookie.match(new RegExp(`${name}=([^;,\\s]+)`));

  return match?.[1] ?? null;
}

describe('Spotify OAuth HTTP handlers', () => {
  it('creates a state cookie and redirects login to the scoped Spotify URL', async () => {
    const handler = createSpotifyLoginHandler({
      config: createConfig(),
      createState: () => 'fixed-oauth-state',
      now: () => NOW,
    });

    const response = await handler(
      new Request(`${ORIGIN}/api/spotify/login`),
    );
    const location = new URL(response.headers.get('location') as string);

    expect(response.status).toBe(302);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(location.origin + location.pathname).toBe(
      'https://accounts.spotify.com/authorize',
    );
    expect(location.searchParams.get('scope')).toBe('user-top-read');
    expect(location.searchParams.get('state')).toBe('fixed-oauth-state');
    expect(readSetCookie(response)).toContain(
      `${SPOTIFY_STATE_COOKIE}=fixed-oauth-state`,
    );
  });

  it('rejects callback state mismatches before exchanging a code', async () => {
    const fetcher = vi.fn<SpotifyFetch>();
    const handler = createSpotifyCallbackHandler({
      config: createConfig(),
      fetcher,
      now: () => NOW,
    });

    const response = await handler(
      new Request(
        `${ORIGIN}/api/spotify/callback?code=code&state=received-state`,
        { headers: { Cookie: `${SPOTIFY_STATE_COOKIE}=expected-state` } },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'invalid_oauth_state',
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(readSetCookie(response)).toContain(`${SPOTIFY_STATE_COOKIE}=`);
  });

  it('handles a verified OAuth denial without calling the token endpoint', async () => {
    const fetcher = vi.fn<SpotifyFetch>();
    const handler = createSpotifyCallbackHandler({
      config: createConfig(),
      fetcher,
      now: () => NOW,
    });

    const response = await handler(
      new Request(
        `${ORIGIN}/api/spotify/callback?error=access_denied&state=oauth-state`,
        { headers: { Cookie: `${SPOTIFY_STATE_COOKIE}=oauth-state` } },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'authorization_denied',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('exchanges a valid callback code and sets an encrypted session cookie', async () => {
    const config = createConfig();
    const fetcher = vi.fn<SpotifyFetch>(async () => tokenResponse());
    const handler = createSpotifyCallbackHandler({
      config,
      fetcher,
      now: () => NOW,
    });

    const response = await handler(
      new Request(
        `${ORIGIN}/api/spotify/callback?code=authorization-code&state=oauth-state`,
        { headers: { Cookie: `${SPOTIFY_STATE_COOKIE}=oauth-state` } },
      ),
    );
    const setCookie = readSetCookie(response);
    const encryptedSession = extractCookieValue(
      setCookie,
      SPOTIFY_SESSION_COOKIE,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(SPOTIFY_PROJECT_PATH);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(SPOTIFY_TOKEN_URL);
    expect(setCookie).toContain(`${SPOTIFY_STATE_COOKIE}=`);
    expect(encryptedSession).not.toBeNull();
    expect(
      decryptSpotifySession(
        encryptedSession as string,
        config.sessionKey,
        NOW,
      ),
    ).toMatchObject({
      accessToken: 'refreshed-access-token',
      refreshToken: 'rotated-refresh-token',
    });
    expect(setCookie).not.toContain('refreshed-access-token');
  });

  it('rejects a malformed callback with verified state but no code', async () => {
    const handler = createSpotifyCallbackHandler({
      config: createConfig(),
      fetcher: vi.fn<SpotifyFetch>(),
      now: () => NOW,
    });

    const response = await handler(
      new Request(`${ORIGIN}/api/spotify/callback?state=oauth-state`, {
        headers: { Cookie: `${SPOTIFY_STATE_COOKIE}=oauth-state` },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'invalid_authorization_response',
    });
  });

  it('rejects duplicate OAuth response parameters', async () => {
    const fetcher = vi.fn<SpotifyFetch>();
    const handler = createSpotifyCallbackHandler({
      config: createConfig(),
      fetcher,
      now: () => NOW,
    });

    const response = await handler(
      new Request(
        `${ORIGIN}/api/spotify/callback?state=oauth-state&code=code&error=&error=access_denied`,
        { headers: { Cookie: `${SPOTIFY_STATE_COOKIE}=oauth-state` } },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'invalid_authorization_response',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('Spotify dashboard HTTP handler', () => {
  it.each<SpotifyTimeRange>([
    'short_term',
    'medium_term',
    'long_term',
  ])('returns whitelisted top data for %s', async (timeRange) => {
    const config = createConfig();
    const fetcher = dashboardFetcher();
    const handler = createSpotifyDashboardHandler({
      config,
      fetcher,
      now: () => NOW,
    });

    const response = await handler(
      new Request(
        `${ORIGIN}/api/spotify/dashboard?timeRange=${timeRange}`,
        { headers: { Cookie: createSessionCookie(config) } },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      timeRange,
      artists: [
        {
          name: 'Artist One',
          imageUrl: 'https://i.scdn.co/image/artist-one',
          spotifyUrl: 'https://open.spotify.com/artist/artist-one',
        },
      ],
      tracks: [
        {
          name: 'Track One',
          spotifyUrl: 'https://open.spotify.com/track/track-one',
          album: {
            name: 'Album One',
            imageUrl: 'https://i.scdn.co/image/album-one',
          },
          artists: [
            {
              name: 'Artist One',
              spotifyUrl: 'https://open.spotify.com/artist/artist-one',
            },
          ],
        },
      ],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    for (const [input, init] of fetcher.mock.calls) {
      const url = new URL(String(input));

      expect(url.searchParams.get('time_range')).toBe(timeRange);
      expect(url.searchParams.get('limit')).toBe('10');
      expect(url.searchParams.get('offset')).toBe('0');
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer access-token',
      });
    }
  });

  it('refreshes an expiring token and returns the updated session cookie', async () => {
    const config = createConfig();
    const fetcher = vi.fn<SpotifyFetch>(async (input, init) => {
      const url = String(input);

      if (url === SPOTIFY_TOKEN_URL) {
        return tokenResponse();
      }

      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer refreshed-access-token',
      });

      return url.includes('/artists')
        ? Response.json(artistPayload())
        : Response.json(trackPayload());
    });
    const handler = createSpotifyDashboardHandler({
      config,
      fetcher,
      now: () => NOW,
    });
    const expiringSession = createSession({
      accessTokenExpiresAt: NOW + 30_000,
    });

    const response = await handler(
      new Request(
        `${ORIGIN}/api/spotify/dashboard?timeRange=medium_term`,
        { headers: { Cookie: createSessionCookie(config, expiringSession) } },
      ),
    );
    const refreshedCookie = extractCookieValue(
      readSetCookie(response),
      SPOTIFY_SESSION_COOKIE,
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(refreshedCookie).not.toBeNull();
    expect(
      decryptSpotifySession(
        refreshedCookie as string,
        config.sessionKey,
        NOW,
      ),
    ).toMatchObject({
      accessToken: 'refreshed-access-token',
      refreshToken: 'rotated-refresh-token',
    });
  });

  it('returns the Development Mode restriction without forwarding Spotify data', async () => {
    const config = createConfig();
    const fetcher = dashboardFetcher({
      artists: Response.json(
        { error: { message: 'not allowlisted', token: 'not-forwarded' } },
        { status: 403 },
      ),
      tracks: Response.json({}, { status: 403 }),
    });
    const handler = createSpotifyDashboardHandler({
      config,
      fetcher,
      now: () => NOW,
    });

    const response = await handler(
      new Request(
        `${ORIGIN}/api/spotify/dashboard?timeRange=short_term`,
        { headers: { Cookie: createSessionCookie(config) } },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: 'This Spotify account is not authorized for the dashboard.',
      code: 'spotify_access_restricted',
    });
    expect(JSON.stringify(body)).not.toContain('not-forwarded');
  });

  it('bounds Spotify throttling Retry-After values', async () => {
    const config = createConfig();
    const fetcher = dashboardFetcher({
      artists: Response.json({}, {
        status: 429,
        headers: { 'Retry-After': '9999' },
      }),
    });
    const handler = createSpotifyDashboardHandler({
      config,
      fetcher,
      now: () => NOW,
    });

    const response = await handler(
      new Request(
        `${ORIGIN}/api/spotify/dashboard?timeRange=short_term`,
        { headers: { Cookie: createSessionCookie(config) } },
      ),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    await expect(response.json()).resolves.toMatchObject({
      code: 'spotify_rate_limited',
    });
  });

  it('rejects malformed upstream display data', async () => {
    const config = createConfig();
    const fetcher = dashboardFetcher({
      artists: Response.json({ items: [{ name: 'Missing fields' }] }),
    });
    const handler = createSpotifyDashboardHandler({
      config,
      fetcher,
      now: () => NOW,
    });

    const response = await handler(
      new Request(
        `${ORIGIN}/api/spotify/dashboard?timeRange=long_term`,
        { headers: { Cookie: createSessionCookie(config) } },
      ),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: 'invalid_spotify_response',
    });
  });

  it('clears expired sessions without making Spotify requests', async () => {
    const config = createConfig();
    const fetcher = vi.fn<SpotifyFetch>();
    const handler = createSpotifyDashboardHandler({
      config,
      fetcher,
      now: () => NOW,
    });
    const expiredSession = createSession({
      accessTokenExpiresAt: NOW - 60_000,
      refreshTokenExpiresAt: NOW,
    });

    const response = await handler(
      new Request(
        `${ORIGIN}/api/spotify/dashboard?timeRange=short_term`,
        { headers: { Cookie: createSessionCookie(config, expiredSession) } },
      ),
    );

    expect(response.status).toBe(401);
    expect(readSetCookie(response)).toContain(
      `${SPOTIFY_SESSION_COOKIE}=`,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('clears sessions when refresh returns invalid_grant', async () => {
    const config = createConfig();
    const fetcher = vi.fn<SpotifyFetch>(async (input) => {
      if (String(input) === SPOTIFY_TOKEN_URL) {
        return Response.json({ error: 'invalid_grant' }, { status: 400 });
      }

      throw new Error('The Spotify API should not be called.');
    });
    const handler = createSpotifyDashboardHandler({
      config,
      fetcher,
      now: () => NOW,
    });

    const response = await handler(
      new Request(
        `${ORIGIN}/api/spotify/dashboard?timeRange=short_term`,
        {
          headers: {
            Cookie: createSessionCookie(
              config,
              createSession({ accessTokenExpiresAt: NOW + 30_000 }),
            ),
          },
        },
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: 'unauthenticated',
    });
    expect(readSetCookie(response)).toContain('Max-Age=0');
  });

  it('rejects invalid or duplicate timeRange values before authentication', async () => {
    const handler = createSpotifyDashboardHandler({
      config: createConfig(),
      fetcher: vi.fn<SpotifyFetch>(),
      now: () => NOW,
    });

    for (const query of [
      'timeRange=weekly',
      'timeRange=short_term&timeRange=long_term',
      '',
    ]) {
      const response = await handler(
        new Request(`${ORIGIN}/api/spotify/dashboard?${query}`),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: 'invalid_time_range',
      });
    }
  });
});

describe('Spotify logout HTTP handler', () => {
  it('clears the session only for same-origin POST requests', async () => {
    const handler = createSpotifyLogoutHandler({
      config: createConfig(),
      now: () => NOW,
    });

    const response = await handler(
      new Request(`${ORIGIN}/api/spotify/logout`, {
        method: 'POST',
        headers: { Origin: ORIGIN },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(readSetCookie(response)).toContain(
      `${SPOTIFY_SESSION_COOKIE}=`,
    );
    expect(readSetCookie(response)).toContain('Max-Age=0');
  });

  it('rejects cross-origin logout attempts without clearing the cookie', async () => {
    const handler = createSpotifyLogoutHandler({
      config: createConfig(),
      now: () => NOW,
    });

    const response = await handler(
      new Request(`${ORIGIN}/api/spotify/logout`, {
        method: 'POST',
        headers: { Origin: 'https://attacker.example' },
      }),
    );

    expect(response.status).toBe(403);
    expect(readSetCookie(response)).toBe('');
    await expect(response.json()).resolves.toMatchObject({
      code: 'invalid_origin',
    });
  });

  it('enforces each endpoint method contract', async () => {
    const config = createConfig();
    const handlers = [
      {
        handler: createSpotifyLoginHandler({ config }),
        request: new Request(`${ORIGIN}/api/spotify/login`, {
          method: 'POST',
        }),
        allow: 'GET',
      },
      {
        handler: createSpotifyCallbackHandler({ config }),
        request: new Request(`${ORIGIN}/api/spotify/callback`, {
          method: 'POST',
        }),
        allow: 'GET',
      },
      {
        handler: createSpotifyDashboardHandler({ config }),
        request: new Request(`${ORIGIN}/api/spotify/dashboard`, {
          method: 'POST',
        }),
        allow: 'GET',
      },
      {
        handler: createSpotifyLogoutHandler({ config }),
        request: new Request(`${ORIGIN}/api/spotify/logout`),
        allow: 'POST',
      },
    ];

    for (const { handler, request, allow } of handlers) {
      const response = await handler(request);

      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe(allow);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });
});
