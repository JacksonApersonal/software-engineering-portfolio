import type { Redis } from '@upstash/redis';
import { describe, expect, it, vi } from 'vitest';
import {
  UpstashCreationRateLimiter,
  UpstashShortLinkStore,
} from './upstash';

describe('UpstashShortLinkStore', () => {
  it('reserves durable link records with SET NX semantics', async () => {
    const set = vi.fn().mockResolvedValue('OK');
    const redis = { set } as unknown as Redis;
    const store = new UpstashShortLinkStore(redis);
    const link = {
      destination: 'https://example.com/',
      createdAt: '2026-11-08T18:00:00.000Z',
    };

    await expect(store.reserveIfAbsent('Ab3x91Qz', link)).resolves.toBe(true);
    expect(set).toHaveBeenCalledWith('short-link:Ab3x91Qz', link, { nx: true });
  });

  it('reports an existing reservation without overwriting it', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue(null),
    } as unknown as Redis;
    const store = new UpstashShortLinkStore(redis);

    await expect(
      store.reserveIfAbsent('Ab3x91Qz', {
        destination: 'https://example.com/',
        createdAt: '2026-11-08T18:00:00.000Z',
      }),
    ).resolves.toBe(false);
  });

  it('retrieves stored link metadata', async () => {
    const link = {
      destination: 'https://example.com/',
      createdAt: '2026-11-08T18:00:00.000Z',
    };
    const redis = {
      get: vi.fn().mockResolvedValue(link),
    } as unknown as Redis;
    const store = new UpstashShortLinkStore(redis);

    await expect(store.get('Ab3x91Qz')).resolves.toEqual(link);
  });
});

describe('UpstashCreationRateLimiter', () => {
  it('uses one atomic expiring Redis script and enforces the limit', async () => {
    const evaluate = vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(11);
    const redis = { eval: evaluate } as unknown as Redis;
    const rateLimiter = new UpstashCreationRateLimiter(redis);

    await expect(rateLimiter.consume('203.0.113.4')).resolves.toBe(true);
    await expect(rateLimiter.consume('203.0.113.4')).resolves.toBe(false);

    const [script, keys, args] = evaluate.mock.calls[0];
    expect(script).toContain("redis.call('INCR'");
    expect(script).toContain("redis.call('EXPIRE'");
    expect(keys[0]).toMatch(/^short-link-rate:[0-9a-f]{64}$/);
    expect(keys[0]).not.toContain('203.0.113.4');
    expect(args).toEqual(['3600']);
  });
});
