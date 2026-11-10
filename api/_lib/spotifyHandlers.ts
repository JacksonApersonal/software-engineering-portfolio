import {
  clearSpotifySessionCookie,
  clearSpotifyStateCookie,
  createSpotifyAuthorizationUrl,
  decryptSpotifySession,
  encryptSpotifySession,
  ensureFreshSpotifySession,
  exchangeAuthorizationCode,
  generateOAuthState,
  readCookieValue,
  refreshSpotifySession,
  serializeSpotifySessionCookie,
  serializeSpotifyStateCookie,
  SPOTIFY_SESSION_COOKIE,
  SPOTIFY_STATE_COOKIE,
  SpotifyAuthError,
  SpotifyReauthorizationRequiredError,
  verifyOAuthState,
  type SpotifyAuthConfig,
  type SpotifyFetch,
  type SpotifySession,
} from './spotifyAuth.js';

export const SPOTIFY_PROJECT_PATH = '/projects/spotify-music-dashboard';

const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const TOP_ITEMS_LIMIT = 10;
const MAX_RETRY_AFTER_SECONDS = 60;

export type SpotifyTimeRange =
  | 'short_term'
  | 'medium_term'
  | 'long_term';

export type SpotifyDashboardArtist = {
  name: string;
  imageUrl: string | null;
  spotifyUrl: string;
};

export type SpotifyDashboardTrack = {
  name: string;
  spotifyUrl: string;
  album: {
    name: string;
    imageUrl: string | null;
  };
  artists: Array<{
    name: string;
    spotifyUrl: string;
  }>;
};

type SpotifyHandlerDependencies = {
  config: SpotifyAuthConfig;
  fetcher?: SpotifyFetch;
  now?: () => number;
};

type SpotifyLoginDependencies = SpotifyHandlerDependencies & {
  createState?: () => string;
};

type DashboardData = {
  artists: SpotifyDashboardArtist[];
  tracks: SpotifyDashboardTrack[];
};

type SpotifyApiFailureKind =
  | 'unauthorized'
  | 'restricted'
  | 'rate_limited'
  | 'malformed'
  | 'unavailable';

class SpotifyApiFailure extends Error {
  readonly kind: SpotifyApiFailureKind;
  readonly retryAfterSeconds?: number;

  constructor(kind: SpotifyApiFailureKind, retryAfterSeconds?: number) {
    super(kind);
    this.name = 'SpotifyApiFailure';
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function createSpotifyLoginHandler({
  config,
  createState = generateOAuthState,
  now = Date.now,
}: SpotifyLoginDependencies): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') {
      return methodNotAllowedResponse('GET');
    }

    const state = createState();
    const headers = new Headers({
      Location: createSpotifyAuthorizationUrl(config, state),
      'Cache-Control': 'no-store',
    });
    headers.append(
      'Set-Cookie',
      serializeSpotifyStateCookie(state, config, now()),
    );

    return new Response(null, { status: 302, headers });
  };
}

export function createSpotifyCallbackHandler({
  config,
  fetcher = fetch,
  now = Date.now,
}: SpotifyHandlerDependencies): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') {
      return methodNotAllowedResponse('GET');
    }

    const clearStateCookie = clearSpotifyStateCookie(config, now());
    const url = new URL(request.url);
    const expectedState = readCookieValue(
      request.headers.get('cookie'),
      SPOTIFY_STATE_COOKIE,
    );
    const receivedState = getSingleSearchParameter(url, 'state');

    if (!verifyOAuthState(expectedState, receivedState)) {
      return withCookie(
        jsonResponse(
          {
            error: 'Spotify authorization could not be verified.',
            code: 'invalid_oauth_state',
          },
          400,
        ),
        clearStateCookie,
      );
    }

    const oauthError = getSingleSearchParameter(url, 'error');
    const code = getSingleSearchParameter(url, 'code');

    if (
      hasMalformedSearchParameter(url, 'error') ||
      hasMalformedSearchParameter(url, 'code')
    ) {
      return withCookie(
        jsonResponse(
          {
            error: 'Spotify returned an invalid authorization response.',
            code: 'invalid_authorization_response',
          },
          400,
        ),
        clearStateCookie,
      );
    }

    if (oauthError === 'access_denied' && !code) {
      return withCookie(
        jsonResponse(
          {
            error: 'Spotify authorization was declined.',
            code: 'authorization_denied',
          },
          400,
        ),
        clearStateCookie,
      );
    }

    if (oauthError !== null || !code) {
      return withCookie(
        jsonResponse(
          {
            error: 'Spotify returned an invalid authorization response.',
            code: 'invalid_authorization_response',
          },
          400,
        ),
        clearStateCookie,
      );
    }

    try {
      const session = await exchangeAuthorizationCode(code, config, {
        fetcher,
        now,
      });
      const encryptedSession = encryptSpotifySession(
        session,
        config.sessionKey,
      );
      const headers = new Headers({
        Location: SPOTIFY_PROJECT_PATH,
        'Cache-Control': 'no-store',
      });
      headers.append('Set-Cookie', clearStateCookie);
      headers.append(
        'Set-Cookie',
        serializeSpotifySessionCookie(
          encryptedSession,
          session,
          config,
          now(),
        ),
      );

      return new Response(null, { status: 302, headers });
    } catch (error) {
      const response =
        error instanceof SpotifyReauthorizationRequiredError
          ? jsonResponse(
              {
                error: 'Spotify authorization could not be completed.',
                code: 'authorization_failed',
              },
              400,
            )
          : jsonResponse(
              {
                error: 'Spotify authentication is temporarily unavailable.',
                code: 'spotify_unavailable',
              },
              error instanceof SpotifyAuthError &&
                error.code === 'invalid_token_response'
                ? 502
                : 503,
            );

      return withCookie(response, clearStateCookie);
    }
  };
}

export function createSpotifyDashboardHandler({
  config,
  fetcher = fetch,
  now = Date.now,
}: SpotifyHandlerDependencies): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET') {
      return methodNotAllowedResponse('GET');
    }

    const url = new URL(request.url);
    const timeRange = readTimeRange(url);

    if (!timeRange) {
      return jsonResponse(
        {
          error: 'A valid timeRange is required.',
          code: 'invalid_time_range',
        },
        400,
      );
    }

    const cookieHeader = request.headers.get('cookie');
    const encryptedSession = readCookieValue(
      cookieHeader,
      SPOTIFY_SESSION_COOKIE,
    );
    const session = encryptedSession
      ? decryptSpotifySession(encryptedSession, config.sessionKey, now())
      : null;

    if (!session) {
      return unauthenticatedResponse(
        config,
        Boolean(encryptedSession),
        now(),
      );
    }

    let activeSession = session;
    let sessionWasUpdated = false;

    try {
      const freshSession = await ensureFreshSpotifySession(session, config, {
        fetcher,
        now,
      });
      sessionWasUpdated = freshSession !== session;
      activeSession = freshSession;

      let dashboardData: DashboardData;

      try {
        dashboardData = await fetchDashboardData(
          activeSession.accessToken,
          timeRange,
          fetcher,
        );
      } catch (error) {
        if (!(error instanceof SpotifyApiFailure) || error.kind !== 'unauthorized') {
          throw error;
        }

        activeSession = await refreshSpotifySession(activeSession, config, {
          fetcher,
          now,
        });
        sessionWasUpdated = true;
        dashboardData = await fetchDashboardData(
          activeSession.accessToken,
          timeRange,
          fetcher,
        );
      }

      return withUpdatedSession(
        jsonResponse({ timeRange, ...dashboardData }, 200),
        activeSession,
        sessionWasUpdated,
        config,
        now(),
      );
    } catch (error) {
      if (
        error instanceof SpotifyReauthorizationRequiredError ||
        (error instanceof SpotifyApiFailure && error.kind === 'unauthorized')
      ) {
        return unauthenticatedResponse(config, true, now());
      }

      const response = spotifyDashboardErrorResponse(error);

      return withUpdatedSession(
        response,
        activeSession,
        sessionWasUpdated,
        config,
        now(),
      );
    }
  };
}

export function createSpotifyLogoutHandler({
  config,
  now = Date.now,
}: SpotifyHandlerDependencies): (request: Request) => Promise<Response> {
  const trustedOrigin = new URL(config.redirectUri).origin;

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') {
      return methodNotAllowedResponse('POST');
    }

    if (request.headers.get('origin') !== trustedOrigin) {
      return jsonResponse(
        {
          error: 'The logout request could not be verified.',
          code: 'invalid_origin',
        },
        403,
      );
    }

    return withCookie(
      new Response(null, {
        status: 204,
        headers: { 'Cache-Control': 'no-store' },
      }),
      clearSpotifySessionCookie(config, now()),
    );
  };
}

export function spotifyServiceUnavailableResponse(): Response {
  return jsonResponse(
    {
      error: 'The Spotify dashboard is temporarily unavailable.',
      code: 'spotify_unavailable',
    },
    503,
  );
}

async function fetchDashboardData(
  accessToken: string,
  timeRange: SpotifyTimeRange,
  fetcher: SpotifyFetch,
): Promise<DashboardData> {
  const query = new URLSearchParams({
    time_range: timeRange,
    limit: String(TOP_ITEMS_LIMIT),
    offset: '0',
  });
  const requestOptions: RequestInit = {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  };
  let responses: [Response, Response];

  try {
    responses = await Promise.all([
      fetcher(`${SPOTIFY_API_URL}/me/top/artists?${query}`, requestOptions),
      fetcher(`${SPOTIFY_API_URL}/me/top/tracks?${query}`, requestOptions),
    ]);
  } catch {
    throw new SpotifyApiFailure('unavailable');
  }

  classifySpotifyResponses(responses);

  try {
    const [artistsPayload, tracksPayload] = await Promise.all(
      responses.map((response) => response.json()),
    );

    return {
      artists: parseArtists(artistsPayload),
      tracks: parseTracks(tracksPayload),
    };
  } catch (error) {
    if (error instanceof SpotifyApiFailure) {
      throw error;
    }

    throw new SpotifyApiFailure('malformed');
  }
}

function classifySpotifyResponses(responses: Response[]): void {
  if (responses.some((response) => response.status === 401)) {
    throw new SpotifyApiFailure('unauthorized');
  }

  if (responses.some((response) => response.status === 403)) {
    throw new SpotifyApiFailure('restricted');
  }

  const throttledResponses = responses.filter(
    (response) => response.status === 429,
  );

  if (throttledResponses.length > 0) {
    const retryAfterSeconds = Math.max(
      ...throttledResponses.map((response) =>
        parseRetryAfter(response.headers.get('retry-after')),
      ),
    );
    throw new SpotifyApiFailure('rate_limited', retryAfterSeconds);
  }

  if (responses.some((response) => !response.ok)) {
    throw new SpotifyApiFailure('unavailable');
  }
}

function parseRetryAfter(value: string | null): number {
  const seconds = value === null ? Number.NaN : Number(value);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 5;
  }

  return Math.min(Math.ceil(seconds), MAX_RETRY_AFTER_SECONDS);
}

function parseArtists(payload: unknown): SpotifyDashboardArtist[] {
  const items = readItems(payload);

  return items.map((item) => ({
    name: readDisplayName(item, 'name'),
    imageUrl: readImageUrl(item, 'images'),
    spotifyUrl: readSpotifyUrl(item, 'external_urls'),
  }));
}

function parseTracks(payload: unknown): SpotifyDashboardTrack[] {
  const items = readItems(payload);

  return items.map((item) => {
    const album = readObjectProperty(item, 'album');
    const artists = readArrayProperty(item, 'artists');

    if (artists.length === 0 || artists.length > 20) {
      throw new SpotifyApiFailure('malformed');
    }

    return {
      name: readDisplayName(item, 'name'),
      spotifyUrl: readSpotifyUrl(item, 'external_urls'),
      album: {
        name: readDisplayName(album, 'name'),
        imageUrl: readImageUrl(album, 'images'),
      },
      artists: artists.map((artist) => {
        const artistObject = requireObject(artist);

        return {
          name: readDisplayName(artistObject, 'name'),
          spotifyUrl: readSpotifyUrl(artistObject, 'external_urls'),
        };
      }),
    };
  });
}

function readItems(payload: unknown): Record<string, unknown>[] {
  const root = requireObject(payload);
  const items = readArrayProperty(root, 'items');

  if (items.length > TOP_ITEMS_LIMIT) {
    throw new SpotifyApiFailure('malformed');
  }

  return items.map(requireObject);
}

function readDisplayName(
  object: Record<string, unknown>,
  property: string,
): string {
  const value = object[property];

  if (typeof value !== 'string' || value.length === 0 || value.length > 500) {
    throw new SpotifyApiFailure('malformed');
  }

  return value;
}

function readImageUrl(
  object: Record<string, unknown>,
  property: string,
): string | null {
  const images = readArrayProperty(object, property);

  if (images.length === 0) {
    return null;
  }

  const image = requireObject(images[0]);
  const value = image.url;

  return typeof value === 'string' ? validateHttpsUrl(value, false) : malformed();
}

function readSpotifyUrl(
  object: Record<string, unknown>,
  property: string,
): string {
  const externalUrls = readObjectProperty(object, property);
  const value = externalUrls.spotify;

  return typeof value === 'string' ? validateHttpsUrl(value, true) : malformed();
}

function validateHttpsUrl(value: string, requireSpotifyHost: boolean): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return malformed();
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (requireSpotifyHost && url.hostname !== 'open.spotify.com')
  ) {
    return malformed();
  }

  return url.toString();
}

function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return malformed();
  }

  return value as Record<string, unknown>;
}

function readObjectProperty(
  object: Record<string, unknown>,
  property: string,
): Record<string, unknown> {
  return requireObject(object[property]);
}

function readArrayProperty(
  object: Record<string, unknown>,
  property: string,
): unknown[] {
  const value = object[property];

  return Array.isArray(value) ? value : malformed();
}

function malformed(): never {
  throw new SpotifyApiFailure('malformed');
}

function readTimeRange(url: URL): SpotifyTimeRange | null {
  const values = url.searchParams.getAll('timeRange');

  if (values.length !== 1) {
    return null;
  }

  const value = values[0];

  return value === 'short_term' ||
    value === 'medium_term' ||
    value === 'long_term'
    ? value
    : null;
}

function getSingleSearchParameter(url: URL, name: string): string | null {
  const values = url.searchParams.getAll(name);

  return values.length === 1 && values[0] ? values[0] : null;
}

function hasMalformedSearchParameter(url: URL, name: string): boolean {
  const values = url.searchParams.getAll(name);

  return values.length > 1 || (values.length === 1 && !values[0]);
}

function spotifyDashboardErrorResponse(error: unknown): Response {
  if (error instanceof SpotifyApiFailure) {
    if (error.kind === 'restricted') {
      return jsonResponse(
        {
          error: 'This Spotify account is not authorized for the dashboard.',
          code: 'spotify_access_restricted',
        },
        403,
      );
    }

    if (error.kind === 'rate_limited') {
      return jsonResponse(
        {
          error: 'Spotify is receiving too many requests. Try again shortly.',
          code: 'spotify_rate_limited',
        },
        429,
        { 'Retry-After': String(error.retryAfterSeconds ?? 5) },
      );
    }

    if (error.kind === 'malformed') {
      return jsonResponse(
        {
          error: 'Spotify returned an unexpected response.',
          code: 'invalid_spotify_response',
        },
        502,
      );
    }
  }

  if (
    error instanceof SpotifyAuthError &&
    error.code === 'invalid_token_response'
  ) {
    return jsonResponse(
      {
        error: 'Spotify returned an unexpected authentication response.',
        code: 'invalid_spotify_response',
      },
      502,
    );
  }

  return spotifyServiceUnavailableResponse();
}

function unauthenticatedResponse(
  config: SpotifyAuthConfig,
  clearCookie: boolean,
  now: number,
): Response {
  const response = jsonResponse(
    {
      error: 'Connect Spotify to view this dashboard.',
      code: 'unauthenticated',
    },
    401,
  );

  return clearCookie
    ? withCookie(response, clearSpotifySessionCookie(config, now))
    : response;
}

function withUpdatedSession(
  response: Response,
  session: SpotifySession,
  sessionWasUpdated: boolean,
  config: SpotifyAuthConfig,
  now: number,
): Response {
  if (!sessionWasUpdated) {
    return response;
  }

  const encryptedSession = encryptSpotifySession(session, config.sessionKey);

  return withCookie(
    response,
    serializeSpotifySessionCookie(
      encryptedSession,
      session,
      config,
      now,
    ),
  );
}

function withCookie(response: Response, cookie: string): Response {
  response.headers.append('Set-Cookie', cookie);
  return response;
}

function methodNotAllowedResponse(allow: string): Response {
  return jsonResponse(
    { error: 'Method not allowed.', code: 'method_not_allowed' },
    405,
    { Allow: allow },
  );
}

function jsonResponse(
  body: object,
  status: number,
  additionalHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...additionalHeaders,
    },
  });
}
