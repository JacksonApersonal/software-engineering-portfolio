import { MAX_URL_LENGTH } from './urlShortener';

export type ShortenUrlResult = {
  code: string;
  shortUrl: string;
  destination: string;
  createdAt: string;
};

export type ShortenUrlErrorKind =
  | 'validation'
  | 'rate-limit'
  | 'unavailable';

type FetchFunction = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export class ShortenUrlRequestError extends Error {
  readonly kind: ShortenUrlErrorKind;

  constructor(kind: ShortenUrlErrorKind, message: string) {
    super(message);
    this.name = 'ShortenUrlRequestError';
    this.kind = kind;
  }
}

export function getDestinationValidationError(input: string): string | null {
  const destination = input.trim();

  if (!destination) {
    return 'Enter a destination URL.';
  }

  if (destination.length > MAX_URL_LENGTH) {
    return `Destination URLs must be ${MAX_URL_LENGTH} characters or fewer.`;
  }

  try {
    const parsed = new URL(destination);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Enter a URL that starts with http:// or https://.';
    }
  } catch {
    return 'Enter a valid HTTP or HTTPS URL.';
  }

  return null;
}

export async function requestShortUrl(
  destination: string,
  fetcher: FetchFunction = fetch,
): Promise<ShortenUrlResult> {
  let response: Response;

  try {
    response = await fetcher('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: destination }),
    });
  } catch {
    throw unavailableError();
  }

  if (response.status === 400) {
    throw new ShortenUrlRequestError(
      'validation',
      await readApiError(response, 'The destination URL is not valid.'),
    );
  }

  if (response.status === 429) {
    throw new ShortenUrlRequestError(
      'rate-limit',
      'Too many URLs have been shortened recently. Please try again later.',
    );
  }

  if (response.status !== 201) {
    throw unavailableError();
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw unavailableError();
  }

  if (!isShortenUrlResult(body)) {
    throw unavailableError();
  }

  return body;
}

function isShortenUrlResult(value: unknown): value is ShortenUrlResult {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('code' in value) ||
    !('shortUrl' in value) ||
    !('destination' in value) ||
    !('createdAt' in value) ||
    typeof value.code !== 'string' ||
    typeof value.shortUrl !== 'string' ||
    typeof value.destination !== 'string' ||
    typeof value.createdAt !== 'string' ||
    !/^[0-9A-Za-z]{8}$/.test(value.code)
  ) {
    return false;
  }

  try {
    const shortUrl = new URL(value.shortUrl);

    return shortUrl.protocol === 'http:' || shortUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

async function readApiError(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const body: unknown = await response.json();

    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string' &&
      body.error.trim()
    ) {
      return body.error;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}

function unavailableError(): ShortenUrlRequestError {
  return new ShortenUrlRequestError(
    'unavailable',
    'The URL shortener is temporarily unavailable. Please try again later.',
  );
}
