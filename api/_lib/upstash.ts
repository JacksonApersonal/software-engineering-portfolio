import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import type {
  ShortLinkStore,
  StoredShortLink,
} from '../../src/lib/urlShortener.js';
import type { CreationRateLimiter } from './handlers.js';

const LINK_KEY_PREFIX = 'short-link:';
const RATE_LIMIT_KEY_PREFIX = 'short-link-rate:';
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

export class UpstashShortLinkStore implements ShortLinkStore {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async reserveIfAbsent(
    code: string,
    link: StoredShortLink,
  ): Promise<boolean> {
    const result = await this.redis.set(`${LINK_KEY_PREFIX}${code}`, link, {
      nx: true,
    });

    return result === 'OK';
  }

  async get(code: string): Promise<StoredShortLink | null> {
    const link = await this.redis.get<StoredShortLink>(
      `${LINK_KEY_PREFIX}${code}`,
    );

    if (!link) {
      return null;
    }

    if (
      typeof link.destination !== 'string' ||
      typeof link.createdAt !== 'string'
    ) {
      throw new Error('Stored short link is invalid.');
    }

    return link;
  }
}

export class UpstashCreationRateLimiter implements CreationRateLimiter {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async consume(identifier: string): Promise<boolean> {
    const identifierHash = createHash('sha256')
      .update(identifier)
      .digest('hex');
    const count = await this.redis.eval<[string], number>(
      RATE_LIMIT_SCRIPT,
      [`${RATE_LIMIT_KEY_PREFIX}${identifierHash}`],
      [String(RATE_LIMIT_WINDOW_SECONDS)],
    );

    return count <= RATE_LIMIT;
  }
}

export function createProductionShortenDependencies(): {
  store: UpstashShortLinkStore;
  rateLimiter: UpstashCreationRateLimiter;
  publicOrigin: string;
} {
  const publicOrigin = process.env.SHORT_URL_ORIGIN;

  if (!publicOrigin) {
    throw new Error('Required server configuration is missing.');
  }

  const redis = createRedisFromEnvironment();

  return {
    store: new UpstashShortLinkStore(redis),
    rateLimiter: new UpstashCreationRateLimiter(redis),
    publicOrigin,
  };
}

export function createProductionStore(): UpstashShortLinkStore {
  return new UpstashShortLinkStore(createRedisFromEnvironment());
}

export function getClientIdentifier(request: Request): string {
  const forwardedFor =
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-forwarded-for');

  return forwardedFor?.split(',')[0]?.trim() || 'unknown-client';
}

function createRedisFromEnvironment(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Required server configuration is missing.');
  }

  return new Redis({ url, token });
}
