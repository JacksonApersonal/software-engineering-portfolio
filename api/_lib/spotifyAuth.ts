import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export const SPOTIFY_SCOPE = 'user-top-read';
export const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
export const SPOTIFY_STATE_COOKIE = 'spotify_oauth_state';
export const SPOTIFY_SESSION_COOKIE = 'spotify_session';
export const SPOTIFY_COOKIE_PATH = '/api/spotify';
export const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;

const ACCESS_TOKEN_REFRESH_LEEWAY_MS = 60_000;
const SESSION_VERSION = 1;
const SESSION_COOKIE_AAD = Buffer.from('spotify-session:v1', 'utf8');
const MAX_COOKIE_BYTES = 4096;

export type SpotifyAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sessionKey: Buffer;
  secureCookies: boolean;
};

export type SpotifySession = {
  version: 1;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
};

export type SpotifyFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type SpotifyAuthErrorCode =
  | 'configuration_error'
  | 'invalid_request'
  | 'token_request_failed'
  | 'invalid_token_response'
  | 'reauthorization_required';

export class SpotifyAuthError extends Error {
  readonly code: SpotifyAuthErrorCode;

  constructor(code: SpotifyAuthErrorCode, message: string) {
    super(message);
    this.name = 'SpotifyAuthError';
    this.code = code;
  }
}

export class SpotifyReauthorizationRequiredError extends SpotifyAuthError {
  constructor() {
    super(
      'reauthorization_required',
      'Spotify authorization must be completed again.',
    );
    this.name = 'SpotifyReauthorizationRequiredError';
  }
}

type TokenResponse = {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken?: string;
};

type CompactSession = {
  v: 1;
  a: string;
  r: string;
  ae: number;
  re: number;
};

type RandomBytes = (size: number) => Uint8Array;

export function loadSpotifyAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): SpotifyAuthConfig {
  const clientId = readRequiredEnvironmentValue(
    environment,
    'SPOTIFY_CLIENT_ID',
  );
  const clientSecret = readRequiredEnvironmentValue(
    environment,
    'SPOTIFY_CLIENT_SECRET',
  );
  const redirectUri = readRequiredEnvironmentValue(
    environment,
    'SPOTIFY_REDIRECT_URI',
  );
  const sessionSecret = readRequiredEnvironmentValue(
    environment,
    'SPOTIFY_SESSION_SECRET',
  );
  const redirectUrl = validateRedirectUri(redirectUri, environment.VERCEL_ENV);

  return {
    clientId,
    clientSecret,
    redirectUri,
    sessionKey: decodeSessionSecret(sessionSecret),
    secureCookies: redirectUrl.protocol === 'https:',
  };
}

export function generateOAuthState(
  randomBytesProvider: RandomBytes = randomBytes,
): string {
  const stateBytes = Buffer.from(randomBytesProvider(32));

  if (stateBytes.byteLength !== 32) {
    throw new SpotifyAuthError(
      'configuration_error',
      'The OAuth state source is invalid.',
    );
  }

  return stateBytes.toString('base64url');
}

export function verifyOAuthState(
  expectedState: string | null | undefined,
  receivedState: string | null | undefined,
): boolean {
  if (!expectedState || !receivedState) {
    return false;
  }

  const expectedDigest = createHash('sha256').update(expectedState).digest();
  const receivedDigest = createHash('sha256').update(receivedState).digest();

  return timingSafeEqual(expectedDigest, receivedDigest);
}

export function createSpotifyAuthorizationUrl(
  config: Pick<SpotifyAuthConfig, 'clientId' | 'redirectUri'>,
  state: string,
): string {
  if (!state) {
    throw new SpotifyAuthError('invalid_request', 'OAuth state is required.');
  }

  const authorizationUrl = new URL(SPOTIFY_AUTHORIZE_URL);
  authorizationUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    scope: SPOTIFY_SCOPE,
    redirect_uri: config.redirectUri,
    state,
  }).toString();

  return authorizationUrl.toString();
}

export async function exchangeAuthorizationCode(
  code: string,
  config: SpotifyAuthConfig,
  options: {
    fetcher?: SpotifyFetch;
    now?: () => number;
  } = {},
): Promise<SpotifySession> {
  if (!code) {
    throw new SpotifyAuthError(
      'invalid_request',
      'An authorization code is required.',
    );
  }

  const now = (options.now ?? Date.now)();
  const token = await requestTokens(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
    config,
    options.fetcher ?? fetch,
    true,
  );

  return {
    version: SESSION_VERSION,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken as string,
    accessTokenExpiresAt: now + token.expiresInSeconds * 1000,
    refreshTokenExpiresAt: now + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000,
  };
}

export async function refreshSpotifySession(
  session: SpotifySession,
  config: SpotifyAuthConfig,
  options: {
    fetcher?: SpotifyFetch;
    now?: () => number;
  } = {},
): Promise<SpotifySession> {
  const now = (options.now ?? Date.now)();

  if (!isValidSession(session) || session.refreshTokenExpiresAt <= now) {
    throw new SpotifyReauthorizationRequiredError();
  }

  const token = await requestTokens(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.refreshToken,
    }),
    config,
    options.fetcher ?? fetch,
    false,
  );

  return {
    ...session,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken ?? session.refreshToken,
    accessTokenExpiresAt: now + token.expiresInSeconds * 1000,
  };
}

export async function ensureFreshSpotifySession(
  session: SpotifySession,
  config: SpotifyAuthConfig,
  options: {
    fetcher?: SpotifyFetch;
    now?: () => number;
    refreshLeewayMs?: number;
  } = {},
): Promise<SpotifySession> {
  const nowProvider = options.now ?? Date.now;
  const now = nowProvider();
  const refreshLeewayMs =
    options.refreshLeewayMs ?? ACCESS_TOKEN_REFRESH_LEEWAY_MS;

  if (!isValidSession(session) || session.refreshTokenExpiresAt <= now) {
    throw new SpotifyReauthorizationRequiredError();
  }

  if (session.accessTokenExpiresAt - now > refreshLeewayMs) {
    return session;
  }

  return refreshSpotifySession(session, config, {
    fetcher: options.fetcher,
    now: nowProvider,
  });
}

export function encryptSpotifySession(
  session: SpotifySession,
  key: Uint8Array,
  randomBytesProvider: RandomBytes = randomBytes,
): string {
  const encryptionKey = validateSessionKey(key);

  if (!isValidSession(session)) {
    throw new SpotifyAuthError(
      'invalid_request',
      'The Spotify session is invalid.',
    );
  }

  const initializationVector = Buffer.from(randomBytesProvider(12));

  if (initializationVector.byteLength !== 12) {
    throw new SpotifyAuthError(
      'configuration_error',
      'The encryption nonce source is invalid.',
    );
  }

  const payload: CompactSession = {
    v: SESSION_VERSION,
    a: session.accessToken,
    r: session.refreshToken,
    ae: session.accessTokenExpiresAt,
    re: session.refreshTokenExpiresAt,
  };
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, initializationVector);
  cipher.setAAD(SESSION_COOKIE_AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const authenticationTag = cipher.getAuthTag();

  return [
    'v1',
    initializationVector.toString('base64url'),
    ciphertext.toString('base64url'),
    authenticationTag.toString('base64url'),
  ].join('.');
}

export function decryptSpotifySession(
  value: string,
  key: Uint8Array,
  now: number = Date.now(),
): SpotifySession | null {
  try {
    const encryptionKey = validateSessionKey(key);
    const parts = value.split('.');

    if (parts.length !== 4 || parts[0] !== 'v1') {
      return null;
    }

    const initializationVector = decodeBase64Url(parts[1] as string);
    const ciphertext = decodeBase64Url(parts[2] as string);
    const authenticationTag = decodeBase64Url(parts[3] as string);

    if (
      initializationVector.byteLength !== 12 ||
      ciphertext.byteLength === 0 ||
      authenticationTag.byteLength !== 16
    ) {
      return null;
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey,
      initializationVector,
    );
    decipher.setAAD(SESSION_COOKIE_AAD);
    decipher.setAuthTag(authenticationTag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
    const payload: unknown = JSON.parse(plaintext);
    const session = expandSession(payload);

    if (!session || session.refreshTokenExpiresAt <= now) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function serializeSpotifyStateCookie(
  state: string,
  config: Pick<SpotifyAuthConfig, 'secureCookies'>,
  now: number = Date.now(),
): string {
  return serializeCookie(SPOTIFY_STATE_COOKIE, state, {
    maxAgeSeconds: OAUTH_STATE_MAX_AGE_SECONDS,
    secure: config.secureCookies,
    now,
  });
}

export function clearSpotifyStateCookie(
  config: Pick<SpotifyAuthConfig, 'secureCookies'>,
  now: number = Date.now(),
): string {
  return serializeCookie(SPOTIFY_STATE_COOKIE, '', {
    maxAgeSeconds: 0,
    secure: config.secureCookies,
    now,
  });
}

export function serializeSpotifySessionCookie(
  encryptedSession: string,
  session: SpotifySession,
  config: Pick<SpotifyAuthConfig, 'secureCookies'>,
  now: number = Date.now(),
): string {
  if (!isValidSession(session) || session.refreshTokenExpiresAt <= now) {
    throw new SpotifyReauthorizationRequiredError();
  }

  const maxAgeSeconds = Math.ceil(
    (session.refreshTokenExpiresAt - now) / 1000,
  );

  return serializeCookie(SPOTIFY_SESSION_COOKIE, encryptedSession, {
    maxAgeSeconds,
    secure: config.secureCookies,
    now,
  });
}

export function clearSpotifySessionCookie(
  config: Pick<SpotifyAuthConfig, 'secureCookies'>,
  now: number = Date.now(),
): string {
  return serializeCookie(SPOTIFY_SESSION_COOKIE, '', {
    maxAgeSeconds: 0,
    secure: config.secureCookies,
    now,
  });
}

export function readCookieValue(
  cookieHeader: string | null,
  cookieName: string,
): string | null {
  if (!cookieHeader || !isValidCookieName(cookieName)) {
    return null;
  }

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=');

    if (separatorIndex < 0) {
      continue;
    }

    const name = cookie.slice(0, separatorIndex).trim();

    if (name !== cookieName) {
      continue;
    }

    const value = cookie.slice(separatorIndex + 1).trim();

    if (Buffer.byteLength(value, 'utf8') > MAX_COOKIE_BYTES) {
      return null;
    }

    return value;
  }

  return null;
}

async function requestTokens(
  body: URLSearchParams,
  config: SpotifyAuthConfig,
  fetcher: SpotifyFetch,
  requireRefreshToken: boolean,
): Promise<TokenResponse> {
  let response: Response;

  try {
    response = await fetcher(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(
          `${config.clientId}:${config.clientSecret}`,
          'utf8',
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
    });
  } catch {
    throw new SpotifyAuthError(
      'token_request_failed',
      'Spotify authentication is temporarily unavailable.',
    );
  }

  const payload = await readJsonObject(response);

  if (!response.ok) {
    if (payload?.error === 'invalid_grant') {
      throw new SpotifyReauthorizationRequiredError();
    }

    throw new SpotifyAuthError(
      'token_request_failed',
      'Spotify authentication is temporarily unavailable.',
    );
  }

  if (
    !payload ||
    typeof payload.access_token !== 'string' ||
    payload.access_token.length === 0 ||
    payload.token_type !== 'Bearer' ||
    typeof payload.expires_in !== 'number' ||
    !Number.isFinite(payload.expires_in) ||
    payload.expires_in <= 0 ||
    (requireRefreshToken &&
      (typeof payload.refresh_token !== 'string' ||
        payload.refresh_token.length === 0)) ||
    (payload.refresh_token !== undefined &&
      typeof payload.refresh_token !== 'string') ||
    (payload.scope !== undefined && typeof payload.scope !== 'string') ||
    (typeof payload.scope === 'string' &&
      !payload.scope.split(' ').includes(SPOTIFY_SCOPE))
  ) {
    throw new SpotifyAuthError(
      'invalid_token_response',
      'Spotify returned an invalid authentication response.',
    );
  }

  return {
    accessToken: payload.access_token,
    expiresInSeconds: payload.expires_in,
    refreshToken: payload.refresh_token as string | undefined,
  };
}

async function readJsonObject(
  response: Response,
): Promise<Record<string, unknown> | null> {
  try {
    const payload: unknown = await response.json();

    return typeof payload === 'object' && payload !== null
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readRequiredEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = environment[name];

  if (!value || value.trim() !== value) {
    throw new SpotifyAuthError(
      'configuration_error',
      `${name} is missing or malformed.`,
    );
  }

  return value;
}

function validateRedirectUri(redirectUri: string, vercelEnvironment?: string): URL {
  let redirectUrl: URL;

  try {
    redirectUrl = new URL(redirectUri);
  } catch {
    throw new SpotifyAuthError(
      'configuration_error',
      'SPOTIFY_REDIRECT_URI is invalid.',
    );
  }

  const isLoopback =
    redirectUrl.hostname === '127.0.0.1' || redirectUrl.hostname === '[::1]';
  const isSecure = redirectUrl.protocol === 'https:';
  const isLocalHttp = redirectUrl.protocol === 'http:' && isLoopback;

  if (
    (!isSecure && !isLocalHttp) ||
    (vercelEnvironment === 'production' && !isSecure) ||
    redirectUrl.username ||
    redirectUrl.password ||
    redirectUrl.search ||
    redirectUrl.hash
  ) {
    throw new SpotifyAuthError(
      'configuration_error',
      'SPOTIFY_REDIRECT_URI is invalid.',
    );
  }

  return redirectUrl;
}

function decodeSessionSecret(value: string): Buffer {
  let key: Buffer;

  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    key = Buffer.from(value, 'hex');
  } else {
    if (!/^[A-Za-z0-9_-]{43}=?$/.test(value)) {
      throwInvalidSessionSecret();
    }

    const withoutPadding = value.replace(/=$/, '');
    key = Buffer.from(withoutPadding, 'base64url');
  }

  if (key.byteLength !== 32) {
    throwInvalidSessionSecret();
  }

  return key;
}

function throwInvalidSessionSecret(): never {
  throw new SpotifyAuthError(
    'configuration_error',
    'SPOTIFY_SESSION_SECRET must encode exactly 32 bytes.',
  );
}

function validateSessionKey(key: Uint8Array): Buffer {
  const normalizedKey = Buffer.from(key);

  if (normalizedKey.byteLength !== 32) {
    throwInvalidSessionSecret();
  }

  return normalizedKey;
}

function decodeBase64Url(value: string): Buffer {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Invalid encoded value.');
  }

  return Buffer.from(value, 'base64url');
}

function expandSession(payload: unknown): SpotifySession | null {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('v' in payload) ||
    !('a' in payload) ||
    !('r' in payload) ||
    !('ae' in payload) ||
    !('re' in payload)
  ) {
    return null;
  }

  const compact = payload as Partial<CompactSession>;
  const session: SpotifySession = {
    version: compact.v as 1,
    accessToken: compact.a as string,
    refreshToken: compact.r as string,
    accessTokenExpiresAt: compact.ae as number,
    refreshTokenExpiresAt: compact.re as number,
  };

  return isValidSession(session) ? session : null;
}

function isValidSession(session: SpotifySession): boolean {
  return (
    session.version === SESSION_VERSION &&
    typeof session.accessToken === 'string' &&
    session.accessToken.length > 0 &&
    typeof session.refreshToken === 'string' &&
    session.refreshToken.length > 0 &&
    Number.isFinite(session.accessTokenExpiresAt) &&
    Number.isFinite(session.refreshTokenExpiresAt) &&
    session.accessTokenExpiresAt > 0 &&
    session.refreshTokenExpiresAt > 0
  );
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAgeSeconds: number;
    secure: boolean;
    now: number;
  },
): string {
  if (
    !isValidCookieName(name) ||
    !/^[A-Za-z0-9._~-]*$/.test(value) ||
    !Number.isSafeInteger(options.maxAgeSeconds) ||
    options.maxAgeSeconds < 0
  ) {
    throw new SpotifyAuthError(
      'invalid_request',
      'The Spotify cookie could not be serialized.',
    );
  }

  const expiresAt = new Date(options.now + options.maxAgeSeconds * 1000);
  const parts = [
    `${name}=${value}`,
    `Path=${SPOTIFY_COOKIE_PATH}`,
    `Max-Age=${options.maxAgeSeconds}`,
    `Expires=${expiresAt.toUTCString()}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (options.secure) {
    parts.push('Secure');
  }

  const cookie = parts.join('; ');

  if (Buffer.byteLength(cookie, 'utf8') > MAX_COOKIE_BYTES) {
    throw new SpotifyAuthError(
      'invalid_request',
      'The Spotify session is too large to store safely.',
    );
  }

  return cookie;
}

function isValidCookieName(name: string): boolean {
  return /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name);
}
