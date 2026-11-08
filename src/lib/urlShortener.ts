export const MAX_URL_LENGTH = 2048;
export const SHORT_CODE_LENGTH = 8;
export const DEFAULT_MAX_RESERVATION_ATTEMPTS = 5;

const BASE62_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const MAX_UNBIASED_BYTE =
  Math.floor(256 / BASE62_ALPHABET.length) * BASE62_ALPHABET.length;

export type StoredShortLink = {
  destination: string;
  createdAt: string;
};

export interface ShortLinkStore {
  reserveIfAbsent(code: string, link: StoredShortLink): Promise<boolean>;
  get(code: string): Promise<StoredShortLink | null>;
}

export type CreatedShortLink = {
  code: string;
  link: StoredShortLink;
};

type CreateShortLinkOptions = {
  generateCode?: () => string;
  now?: () => Date;
  maxAttempts?: number;
};

export class InvalidDestinationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDestinationError';
  }
}

export class ShortCodeReservationError extends Error {
  constructor() {
    super('Unable to reserve a unique short code.');
    this.name = 'ShortCodeReservationError';
  }
}

export function validateAndNormalizeUrl(input: string): string {
  const candidate = input.trim();

  if (candidate.length === 0) {
    throw new InvalidDestinationError('A destination URL is required.');
  }

  if (candidate.length > MAX_URL_LENGTH) {
    throw new InvalidDestinationError('The destination URL is too long.');
  }

  let destination: URL;

  try {
    destination = new URL(candidate);
  } catch {
    throw new InvalidDestinationError('The destination URL is malformed.');
  }

  if (destination.protocol !== 'http:' && destination.protocol !== 'https:') {
    throw new InvalidDestinationError(
      'Only HTTP and HTTPS destination URLs are allowed.',
    );
  }

  if (destination.username || destination.password) {
    throw new InvalidDestinationError(
      'Destination URLs cannot contain embedded credentials.',
    );
  }

  const hostname = normalizeHostname(destination.hostname);

  if (isLocalHostname(hostname)) {
    throw new InvalidDestinationError('Local destination hostnames are not allowed.');
  }

  if (isPrivateOrLoopbackIp(hostname)) {
    throw new InvalidDestinationError(
      'Private or loopback destination addresses are not allowed.',
    );
  }

  const normalized = destination.toString();

  if (normalized.length > MAX_URL_LENGTH) {
    throw new InvalidDestinationError('The destination URL is too long.');
  }

  return normalized;
}

export function generateShortCode(): string {
  let code = '';

  while (code.length < SHORT_CODE_LENGTH) {
    const bytes = new Uint8Array((SHORT_CODE_LENGTH - code.length) * 2);
    globalThis.crypto.getRandomValues(bytes);

    for (const byte of bytes) {
      if (byte >= MAX_UNBIASED_BYTE) {
        continue;
      }

      code += BASE62_ALPHABET[byte % BASE62_ALPHABET.length];

      if (code.length === SHORT_CODE_LENGTH) {
        break;
      }
    }
  }

  return code;
}

export async function createShortLink(
  input: string,
  store: ShortLinkStore,
  options: CreateShortLinkOptions = {},
): Promise<CreatedShortLink> {
  const destination = validateAndNormalizeUrl(input);
  const maxAttempts =
    options.maxAttempts ?? DEFAULT_MAX_RESERVATION_ATTEMPTS;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError('maxAttempts must be a positive integer.');
  }

  const link: StoredShortLink = {
    destination,
    createdAt: (options.now ?? (() => new Date()))().toISOString(),
  };
  const codeGenerator = options.generateCode ?? generateShortCode;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = codeGenerator();
    const wasReserved = await store.reserveIfAbsent(code, link);

    if (wasReserved) {
      return { code, link };
    }
  }

  throw new ShortCodeReservationError();
}

function normalizeHostname(hostname: string): string {
  const withoutIpv6Brackets = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  return withoutIpv6Brackets.toLowerCase().replace(/\.$/, '');
}

function isLocalHostname(hostname: string): boolean {
  if (hostname.includes(':') || parseIpv4(hostname)) {
    return false;
  }

  if (!hostname.includes('.')) {
    return true;
  }

  return (
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home') ||
    hostname === 'home.arpa' ||
    hostname.endsWith('.home.arpa')
  );
}

function isPrivateOrLoopbackIp(hostname: string): boolean {
  const ipv4 = parseIpv4(hostname);

  if (ipv4) {
    const [first, second] = ipv4;

    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  if (!hostname.includes(':')) {
    return false;
  }

  return (
    hostname === '::' ||
    hostname === '::1' ||
    hostname.startsWith('fc') ||
    hostname.startsWith('fd') ||
    /^fe[89ab]/.test(hostname) ||
    hostname.startsWith('::ffff:')
  );
}

function parseIpv4(hostname: string): [number, number, number, number] | null {
  const parts = hostname.split('.');

  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map(Number);

  if (
    octets.some(
      (octet, index) =>
        !Number.isInteger(octet) ||
        octet < 0 ||
        octet > 255 ||
        String(octet) !== parts[index],
    )
  ) {
    return null;
  }

  return octets as [number, number, number, number];
}
