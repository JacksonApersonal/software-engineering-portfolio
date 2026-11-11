import { describe, expect, it } from 'vitest';
import type { SpotifyDashboardTrack } from './spotifyClient';
import {
  buildTrackArtistShares,
  countUniqueTrackArtists,
} from './spotifyDashboardAnalytics';

function createTrack(
  name: string,
  artists: Array<{ name: string; id: string }>,
): SpotifyDashboardTrack {
  return {
    name,
    spotifyUrl: `https://open.spotify.com/track/${name}`,
    album: { name: `${name} Album`, imageUrl: null },
    artists: artists.map((artist) => ({
      name: artist.name,
      spotifyUrl: `https://open.spotify.com/artist/${artist.id}`,
    })),
  };
}

describe('Spotify dashboard analytics', () => {
  it('calculates track share from each track primary credited artist', () => {
    const tracks = [
      createTrack('one', [{ name: 'Artist A', id: 'a' }]),
      createTrack('two', [
        { name: 'Artist A', id: 'a' },
        { name: 'Artist B', id: 'b' },
      ]),
      createTrack('three', [{ name: 'Artist B', id: 'b' }]),
      createTrack('four', [{ name: 'Artist C', id: 'c' }]),
    ];

    expect(buildTrackArtistShares(tracks)).toEqual([
      {
        key: 'https://open.spotify.com/artist/a',
        label: 'Artist A',
        count: 2,
        percentage: 50,
      },
      {
        key: 'https://open.spotify.com/artist/b',
        label: 'Artist B',
        count: 1,
        percentage: 25,
      },
      {
        key: 'https://open.spotify.com/artist/c',
        label: 'Artist C',
        count: 1,
        percentage: 25,
      },
    ]);
  });

  it('groups smaller primary-artist categories into Other', () => {
    const tracks = [
      createTrack('one', [{ name: 'Artist A', id: 'a' }]),
      createTrack('two', [{ name: 'Artist A', id: 'a' }]),
      createTrack('three', [{ name: 'Artist B', id: 'b' }]),
      createTrack('four', [{ name: 'Artist C', id: 'c' }]),
      createTrack('five', [{ name: 'Artist D', id: 'd' }]),
      createTrack('six', [{ name: 'Artist E', id: 'e' }]),
    ];

    expect(buildTrackArtistShares(tracks, 4)).toEqual([
      expect.objectContaining({ label: 'Artist A', count: 2 }),
      expect.objectContaining({ label: 'Artist B', count: 1 }),
      expect.objectContaining({ label: 'Artist C', count: 1 }),
      expect.objectContaining({ key: 'other', label: 'Other', count: 2 }),
    ]);
  });

  it('counts unique artists across every track credit', () => {
    const tracks = [
      createTrack('one', [
        { name: 'Artist A', id: 'a' },
        { name: 'Artist B', id: 'b' },
      ]),
      createTrack('two', [
        { name: 'Artist A', id: 'a' },
        { name: 'Artist C', id: 'c' },
      ]),
    ];

    expect(countUniqueTrackArtists(tracks)).toBe(3);
  });

  it('returns empty analytics for an empty track list', () => {
    expect(buildTrackArtistShares([])).toEqual([]);
    expect(countUniqueTrackArtists([])).toBe(0);
  });
});
