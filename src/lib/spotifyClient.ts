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

export type SpotifyDashboardData = {
  timeRange: SpotifyTimeRange;
  artists: SpotifyDashboardArtist[];
  tracks: SpotifyDashboardTrack[];
};

export type SpotifyDashboardErrorKind =
  | 'unauthenticated'
  | 'restricted'
  | 'rate-limit'
  | 'invalid-response'
  | 'unavailable';

type FetchFunction = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

type RequestOptions = {
  fetcher?: FetchFunction;
  signal?: AbortSignal;
};

export class SpotifyDashboardRequestError extends Error {
  readonly kind: SpotifyDashboardErrorKind;
  readonly retryAfterSeconds?: number;

  constructor(
    kind: SpotifyDashboardErrorKind,
    message: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'SpotifyDashboardRequestError';
    this.kind = kind;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function requestSpotifyDashboard(
  timeRange: SpotifyTimeRange,
  options: RequestOptions = {},
): Promise<SpotifyDashboardData> {
  const fetcher = options.fetcher ?? fetch;
  let response: Response;

  try {
    response = await fetcher(
      `/api/spotify/dashboard?timeRange=${encodeURIComponent(timeRange)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        signal: options.signal,
      },
    );
  } catch (error) {
    if (options.signal?.aborted || isAbortError(error)) {
      throw error;
    }

    throw unavailableError();
  }

  if (!response.ok) {
    throw await mapErrorResponse(response);
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw invalidResponseError();
  }

  return parseDashboardData(payload, timeRange);
}

export async function disconnectSpotify(
  fetcher: FetchFunction = fetch,
): Promise<void> {
  let response: Response;

  try {
    response = await fetcher('/api/spotify/logout', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
  } catch {
    throw new SpotifyDashboardRequestError(
      'unavailable',
      'Spotify could not be disconnected. Please try again.',
    );
  }

  if (response.status !== 204) {
    throw new SpotifyDashboardRequestError(
      'unavailable',
      'Spotify could not be disconnected. Please try again.',
    );
  }
}

function parseDashboardData(
  payload: unknown,
  requestedTimeRange: SpotifyTimeRange,
): SpotifyDashboardData {
  const root = requireObject(payload);

  if (root.timeRange !== requestedTimeRange) {
    throw invalidResponseError();
  }

  const artists = requireArray(root.artists);
  const tracks = requireArray(root.tracks);

  if (artists.length > 10 || tracks.length > 10) {
    throw invalidResponseError();
  }

  return {
    timeRange: requestedTimeRange,
    artists: artists.map(parseArtist),
    tracks: tracks.map(parseTrack),
  };
}

function parseArtist(value: unknown): SpotifyDashboardArtist {
  const artist = requireObject(value);

  return {
    name: requireDisplayName(artist.name),
    imageUrl: requireImageUrl(artist.imageUrl),
    spotifyUrl: requireSpotifyUrl(artist.spotifyUrl),
  };
}

function parseTrack(value: unknown): SpotifyDashboardTrack {
  const track = requireObject(value);
  const album = requireObject(track.album);
  const artists = requireArray(track.artists);

  if (artists.length === 0 || artists.length > 20) {
    throw invalidResponseError();
  }

  return {
    name: requireDisplayName(track.name),
    spotifyUrl: requireSpotifyUrl(track.spotifyUrl),
    album: {
      name: requireDisplayName(album.name),
      imageUrl: requireImageUrl(album.imageUrl),
    },
    artists: artists.map((value) => {
      const artist = requireObject(value);

      return {
        name: requireDisplayName(artist.name),
        spotifyUrl: requireSpotifyUrl(artist.spotifyUrl),
      };
    }),
  };
}

async function mapErrorResponse(
  response: Response,
): Promise<SpotifyDashboardRequestError> {
  const code = await readErrorCode(response);

  if (response.status === 401 && code === 'unauthenticated') {
    return new SpotifyDashboardRequestError(
      'unauthenticated',
      'Connect Spotify to view your listening dashboard.',
    );
  }

  if (response.status === 403 && code === 'spotify_access_restricted') {
    return new SpotifyDashboardRequestError(
      'restricted',
      'This Spotify account is not authorized for this Development Mode app.',
    );
  }

  if (response.status === 429 && code === 'spotify_rate_limited') {
    const retryAfterSeconds = parseRetryAfter(
      response.headers.get('retry-after'),
    );

    return new SpotifyDashboardRequestError(
      'rate-limit',
      `Spotify is receiving too many requests. Try again in about ${retryAfterSeconds} seconds.`,
      retryAfterSeconds,
    );
  }

  if (response.status === 502 && code === 'invalid_spotify_response') {
    return invalidResponseError();
  }

  return unavailableError();
}

async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const payload = requireObject(await response.json());

    return typeof payload.code === 'string' ? payload.code : null;
  } catch {
    return null;
  }
}

function parseRetryAfter(value: string | null): number {
  const seconds = value === null ? Number.NaN : Number(value);

  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(Math.ceil(seconds), 60)
    : 5;
}

function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidResponseError();
  }

  return value as Record<string, unknown>;
}

function requireArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw invalidResponseError();
  }

  return value;
}

function requireDisplayName(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 500) {
    throw invalidResponseError();
  }

  return value;
}

function requireImageUrl(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'string' ? requireHttpsUrl(value, false) : invalid();
}

function requireSpotifyUrl(value: unknown): string {
  return typeof value === 'string' ? requireHttpsUrl(value, true) : invalid();
}

function requireHttpsUrl(value: string, requireSpotifyHost: boolean): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return invalid();
  }

  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (requireSpotifyHost && url.hostname !== 'open.spotify.com')
  ) {
    return invalid();
  }

  return url.toString();
}

function invalid(): never {
  throw invalidResponseError();
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function invalidResponseError(): SpotifyDashboardRequestError {
  return new SpotifyDashboardRequestError(
    'invalid-response',
    'Spotify returned an unexpected response. Please try again later.',
  );
}

function unavailableError(): SpotifyDashboardRequestError {
  return new SpotifyDashboardRequestError(
    'unavailable',
    'The Spotify dashboard is temporarily unavailable. Please try again later.',
  );
}
