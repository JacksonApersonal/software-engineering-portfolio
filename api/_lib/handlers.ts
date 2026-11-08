import {
  createShortLink,
  InvalidDestinationError,
  ShortCodeReservationError,
  validateAndNormalizeUrl,
  type ShortLinkStore,
} from '../../src/lib/urlShortener';

export const MAX_REQUEST_BODY_BYTES = 4096;
export const SHORT_CODE_PATTERN = /^[0-9A-Za-z]{8}$/;

export interface CreationRateLimiter {
  consume(identifier: string): Promise<boolean>;
}

type ShortenHandlerDependencies = {
  store: ShortLinkStore;
  rateLimiter: CreationRateLimiter;
  publicOrigin: string;
  getClientIdentifier: (request: Request) => string;
};

type RedirectHandlerDependencies = {
  store: ShortLinkStore;
};

class RequestValidationError extends Error {}

export function createShortenHandler({
  store,
  rateLimiter,
  publicOrigin,
  getClientIdentifier,
}: ShortenHandlerDependencies): (request: Request) => Promise<Response> {
  const trustedOrigin = normalizePublicOrigin(publicOrigin);

  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') {
      return jsonResponse(
        { error: 'Method not allowed.' },
        405,
        { Allow: 'POST' },
      );
    }

    let input: string;

    try {
      input = await readDestination(request);
    } catch (error) {
      const message =
        error instanceof RequestValidationError
          ? error.message
          : 'The request body is invalid.';

      return jsonResponse({ error: message }, 400);
    }

    try {
      const isAllowed = await rateLimiter.consume(getClientIdentifier(request));

      if (!isAllowed) {
        return jsonResponse(
          { error: 'Too many short links have been requested. Try again later.' },
          429,
        );
      }

      const result = await createShortLink(input, store);

      return jsonResponse(
        {
          code: result.code,
          shortUrl: `${trustedOrigin}/s/${result.code}`,
          destination: result.link.destination,
          createdAt: result.link.createdAt,
        },
        201,
      );
    } catch (error) {
      if (error instanceof InvalidDestinationError) {
        return jsonResponse({ error: error.message }, 400);
      }

      if (error instanceof ShortCodeReservationError) {
        return jsonResponse(
          { error: 'The short-link service is temporarily unavailable.' },
          503,
        );
      }

      return jsonResponse(
        { error: 'The short-link service is temporarily unavailable.' },
        503,
      );
    }
  };
}

export function createRedirectHandler({
  store,
}: RedirectHandlerDependencies): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const isHeadRequest = request.method === 'HEAD';

    if (request.method !== 'GET' && !isHeadRequest) {
      return jsonResponse(
        { error: 'Method not allowed.' },
        405,
        { Allow: 'GET, HEAD' },
      );
    }

    const code = new URL(request.url).searchParams.get('code');

    if (!code || !SHORT_CODE_PATTERN.test(code)) {
      return errorResponse('The short code is invalid.', 400, isHeadRequest);
    }

    try {
      const link = await store.get(code);

      if (!link) {
        return errorResponse('Short link not found.', 404, isHeadRequest);
      }

      const destination = validateAndNormalizeUrl(link.destination);

      return new Response(null, {
        status: 302,
        headers: {
          Location: destination,
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      return errorResponse(
        'The short-link service is temporarily unavailable.',
        503,
        isHeadRequest,
      );
    }
  };
}

export function serviceUnavailableResponse(): Response {
  return jsonResponse(
    { error: 'The short-link service is temporarily unavailable.' },
    503,
  );
}

function normalizePublicOrigin(input: string): string {
  let origin: URL;

  try {
    origin = new URL(input);
  } catch {
    throw new Error('SHORT_URL_ORIGIN is invalid.');
  }

  if (
    (origin.protocol !== 'http:' && origin.protocol !== 'https:') ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  ) {
    throw new Error('SHORT_URL_ORIGIN is invalid.');
  }

  return origin.origin;
}

async function readDestination(request: Request): Promise<string> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.split(';', 1)[0]?.trim() !== 'application/json') {
    throw new RequestValidationError('Content-Type must be application/json.');
  }

  const declaredLength = Number(request.headers.get('content-length'));

  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    throw new RequestValidationError('The request body is too large.');
  }

  const body = await readLimitedBody(request);
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    throw new RequestValidationError('The request body must contain valid JSON.');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('url' in parsed) ||
    typeof parsed.url !== 'string'
  ) {
    throw new RequestValidationError('The request body must include a URL string.');
  }

  return parsed.url;
}

async function readLimitedBody(request: Request): Promise<string> {
  if (!request.body) {
    return '';
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > MAX_REQUEST_BODY_BYTES) {
      await reader.cancel();
      throw new RequestValidationError('The request body is too large.');
    }

    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  chunks.forEach((chunk) => {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  });

  return new TextDecoder().decode(body);
}

function errorResponse(
  message: string,
  status: number,
  omitBody: boolean,
): Response {
  if (omitBody) {
    return new Response(null, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return jsonResponse({ error: message }, status);
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
