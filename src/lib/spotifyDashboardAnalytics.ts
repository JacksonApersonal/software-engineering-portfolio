import type { SpotifyDashboardTrack } from './spotifyClient';

export type TrackArtistShare = {
  key: string;
  label: string;
  count: number;
  percentage: number;
};

export function buildTrackArtistShares(
  tracks: SpotifyDashboardTrack[],
  maxCategories = 5,
): TrackArtistShare[] {
  if (tracks.length === 0 || maxCategories < 2) {
    return [];
  }

  const counts = new Map<
    string,
    { label: string; count: number; firstTrackIndex: number }
  >();

  tracks.forEach((track, trackIndex) => {
    const primaryArtist = track.artists[0];
    const existing = counts.get(primaryArtist.spotifyUrl);

    if (existing) {
      existing.count += 1;
      return;
    }

    counts.set(primaryArtist.spotifyUrl, {
      label: primaryArtist.name,
      count: 1,
      firstTrackIndex: trackIndex,
    });
  });

  const sortedShares = [...counts.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort(
      (first, second) =>
        second.count - first.count ||
        first.firstTrackIndex - second.firstTrackIndex,
    );

  const visibleShares =
    sortedShares.length > maxCategories
      ? [
          ...sortedShares.slice(0, maxCategories - 1),
          {
            key: 'other',
            label: 'Other',
            count: sortedShares
              .slice(maxCategories - 1)
              .reduce((total, share) => total + share.count, 0),
            firstTrackIndex: Number.MAX_SAFE_INTEGER,
          },
        ]
      : sortedShares;

  return visibleShares.map(({ key, label, count }) => ({
    key,
    label,
    count,
    percentage: (count / tracks.length) * 100,
  }));
}

export function countUniqueTrackArtists(
  tracks: SpotifyDashboardTrack[],
): number {
  return new Set(
    tracks.flatMap((track) =>
      track.artists.map((artist) => artist.spotifyUrl),
    ),
  ).size;
}
