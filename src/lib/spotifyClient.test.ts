import { describe, expect, it, vi } from 'vitest';
import {
  disconnectSpotify,
  requestSpotifyDashboard,
} from './spotifyClient';

function validDashboardResponse() {
  return {
    timeRange: 'medium_term',
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
  };
}

describe('Spotify dashboard API client', () => {
  it('requests and parses the authenticated dashboard contract', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(validDashboardResponse()),
    );
    const controller = new AbortController();

    await expect(
      requestSpotifyDashboard('medium_term', {
        fetcher,
        signal: controller.signal,
      }),
    ).resolves.toEqual(validDashboardResponse());
    expect(fetcher).toHaveBeenCalledWith(
      '/api/spotify/dashboard?timeRange=medium_term',
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        signal: controller.signal,
      },
    );
  });

  it.each([
    [401, 'unauthenticated', 'unauthenticated'],
    [403, 'spotify_access_restricted', 'restricted'],
    [502, 'invalid_spotify_response', 'invalid-response'],
    [503, 'spotify_unavailable', 'unavailable'],
  ])('maps HTTP %s and %s to %s', async (status, code, kind) => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({ error: 'unsafe upstream detail', code }, { status }),
    );

    await expect(
      requestSpotifyDashboard('short_term', { fetcher }),
    ).rejects.toMatchObject({ kind });
  });

  it('maps and bounds rate-limit retry guidance', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(
        { code: 'spotify_rate_limited' },
        { status: 429, headers: { 'Retry-After': '999' } },
      ),
    );

    await expect(
      requestSpotifyDashboard('long_term', { fetcher }),
    ).rejects.toMatchObject({
      kind: 'rate-limit',
      retryAfterSeconds: 60,
      message: expect.stringContaining('60 seconds'),
    });
  });

  it.each([
    ['wrong time range', { ...validDashboardResponse(), timeRange: 'short_term' }],
    [
      'unsafe artist link',
      {
        ...validDashboardResponse(),
        artists: [
          {
            ...validDashboardResponse().artists[0],
            spotifyUrl: 'javascript:alert(1)',
          },
        ],
      },
    ],
    [
      'missing track artists',
      {
        ...validDashboardResponse(),
        tracks: [{ ...validDashboardResponse().tracks[0], artists: [] }],
      },
    ],
  ])('rejects %s in a success payload', async (_case, payload) => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(payload));

    await expect(
      requestSpotifyDashboard('medium_term', { fetcher }),
    ).rejects.toMatchObject({ kind: 'invalid-response' });
  });

  it('maps network failures without exposing implementation details', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('private network detail'));

    await expect(
      requestSpotifyDashboard('medium_term', { fetcher }),
    ).rejects.toMatchObject({
      kind: 'unavailable',
      message: expect.not.stringContaining('private network detail'),
    });
  });

  it('preserves abort failures so stale requests can be ignored', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException('Aborted', 'AbortError');
    const fetcher = vi.fn().mockRejectedValue(abortError);

    await expect(
      requestSpotifyDashboard('medium_term', {
        fetcher,
        signal: controller.signal,
      }),
    ).rejects.toBe(abortError);
  });
});

describe('Spotify logout API client', () => {
  it('posts a credentialed logout request', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    await expect(disconnectSpotify(fetcher)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith('/api/spotify/logout', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
  });

  it('reports failed logout safely', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({ error: 'internal detail' }, { status: 503 }),
    );

    await expect(disconnectSpotify(fetcher)).rejects.toMatchObject({
      kind: 'unavailable',
      message: expect.not.stringContaining('internal detail'),
    });
  });
});
