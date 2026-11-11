import { useEffect, useRef, useState } from 'react';
import {
  disconnectSpotify,
  requestSpotifyDashboard,
  SpotifyDashboardRequestError,
  type SpotifyDashboardArtist,
  type SpotifyDashboardData,
  type SpotifyDashboardTrack,
  type SpotifyTimeRange,
} from '../../lib/spotifyClient';
import {
  buildTrackArtistShares,
  countUniqueTrackArtists,
  type TrackArtistShare,
} from '../../lib/spotifyDashboardAnalytics';

const timeRanges: Array<{
  value: SpotifyTimeRange;
  label: string;
}> = [
  { value: 'short_term', label: 'Last 4 Weeks' },
  { value: 'medium_term', label: 'Last 6 Months' },
  { value: 'long_term', label: 'Last 12 Months' },
];

const chartColors = ['#34d399', '#a78bfa', '#22d3ee', '#fbbf24', '#a3a3a3'];

export function SpotifyMusicDashboardDemo() {
  const [timeRange, setTimeRange] =
    useState<SpotifyTimeRange>('medium_term');
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<SpotifyDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [error, setError] =
    useState<SpotifyDashboardRequestError | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    'Checking your Spotify connection.',
  );
  const requestSequenceRef = useRef(0);
  const activeRequestRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeRequestRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestSequence = ++requestSequenceRef.current;
    activeRequestRef.current?.abort();
    activeRequestRef.current = controller;

    void requestSpotifyDashboard(timeRange, { signal: controller.signal })
      .then((dashboardData) => {
        if (
          controller.signal.aborted ||
          requestSequence !== requestSequenceRef.current
        ) {
          return;
        }

        setData(dashboardData);
        const itemCount =
          dashboardData.artists.length + dashboardData.tracks.length;
        setStatusMessage(
          itemCount === 0
            ? `No Spotify listening data was returned for ${getTimeRangeLabel(timeRange)}.`
            : `Spotify dashboard loaded for ${getTimeRangeLabel(timeRange)}.`,
        );
      })
      .catch((requestError: unknown) => {
        if (
          controller.signal.aborted ||
          requestSequence !== requestSequenceRef.current
        ) {
          return;
        }

        const dashboardError =
          requestError instanceof SpotifyDashboardRequestError
            ? requestError
            : new SpotifyDashboardRequestError(
                'unavailable',
                'The Spotify dashboard is temporarily unavailable. Please try again later.',
              );

        if (dashboardError.kind === 'unauthenticated') {
          setIsDisconnected(true);
          setStatusMessage('Spotify is not connected.');
          return;
        }

        setError(dashboardError);
        setStatusMessage(dashboardError.message);
      })
      .finally(() => {
        if (
          !controller.signal.aborted &&
          requestSequence === requestSequenceRef.current
        ) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [reloadKey, timeRange]);

  function handleTimeRangeSelect(nextTimeRange: SpotifyTimeRange) {
    if (nextTimeRange === timeRange || isLoading) {
      return;
    }

    prepareForDashboardRequest(
      `Loading Spotify data for ${getTimeRangeLabel(nextTimeRange)}.`,
    );
    setTimeRange(nextTimeRange);
  }

  function handleRetry() {
    prepareForDashboardRequest(
      `Retrying Spotify data for ${getTimeRangeLabel(timeRange)}.`,
    );
    setReloadKey((current) => current + 1);
  }

  function prepareForDashboardRequest(message: string) {
    activeRequestRef.current?.abort();
    setIsLoading(true);
    setIsDisconnected(false);
    setError(null);
    setData(null);
    setStatusMessage(message);
  }

  async function handleDisconnect() {
    if (isDisconnecting) {
      return;
    }

    activeRequestRef.current?.abort();
    requestSequenceRef.current += 1;
    setIsDisconnecting(true);
    setData(null);
    setError(null);
    setStatusMessage('Disconnecting Spotify.');

    try {
      await disconnectSpotify();

      if (!isMountedRef.current) {
        return;
      }

      setIsDisconnected(true);
      setStatusMessage('Spotify disconnected.');
    } catch (disconnectError) {
      if (!isMountedRef.current) {
        return;
      }

      const dashboardError =
        disconnectError instanceof SpotifyDashboardRequestError
          ? disconnectError
          : new SpotifyDashboardRequestError(
              'unavailable',
              'Spotify could not be disconnected. Please try again.',
            );
      setError(dashboardError);
      setStatusMessage(dashboardError.message);
    } finally {
      if (isMountedRef.current) {
        setIsDisconnecting(false);
      }
    }
  }

  const hasResults = Boolean(
    data && (data.artists.length > 0 || data.tracks.length > 0),
  );
  const showDisconnect = Boolean(data || error);

  return (
    <div
      className="w-full overflow-hidden rounded-2xl border border-neutral-800 bg-[#080b0d] shadow-2xl shadow-black/30"
      aria-busy={isLoading || isDisconnecting}
    >
      <DashboardHeader
        showDisconnect={showDisconnect}
        isDisconnecting={isDisconnecting}
        onDisconnect={handleDisconnect}
      />

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>

      <div className="p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <LoadingState />
        ) : isDisconnected ? (
          <DisconnectedState />
        ) : error ? (
          <ErrorState error={error} onRetry={handleRetry} />
        ) : data ? (
          <div className="space-y-8">
            <TimeRangeSelector
              selected={timeRange}
              onSelect={handleTimeRangeSelect}
            />

            {hasResults ? (
              <DashboardResults data={data} />
            ) : (
              <EmptyState />
            )}
          </div>
        ) : null}
      </div>

      <p className="border-t border-neutral-800 bg-black/20 px-5 py-4 text-xs leading-5 text-neutral-500 sm:px-8">
        Listening affinity data and artwork are provided by Spotify. Rankings
        reflect Spotify&apos;s top-item order for the selected period—not play
        counts or listening time. Links open official Spotify pages, and no
        listening data is stored in this browser.
      </p>
    </div>
  );
}

function DashboardHeader({
  showDisconnect,
  isDisconnecting,
  onDisconnect,
}: {
  showDisconnect: boolean;
  isDisconnecting: boolean;
  onDisconnect: () => void;
}) {
  return (
    <header className="relative overflow-hidden border-b border-emerald-400/15 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.18),transparent_38%),radial-gradient(circle_at_85%_15%,rgba(167,139,250,0.18),transparent_30%),#101416] px-5 py-7 sm:px-8 sm:py-9">
      <div
        className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:32px_32px]"
        aria-hidden="true"
      />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300 shadow-lg shadow-emerald-950/30">
              <MusicAnalyticsIcon />
            </span>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
              Spotify Music Analytics
            </p>
          </div>
          <h3 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Your listening, visualized.
          </h3>
          <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-300 sm:text-base">
            Explore the artists and tracks Spotify associates with your
            listening across three affinity windows.
          </p>
        </div>

        {showDisconnect && (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={isDisconnecting}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/20 px-4 py-2 text-sm font-medium text-neutral-200 backdrop-blur transition hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:text-neutral-600"
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect Spotify'}
          </button>
        )}
      </div>
    </header>
  );
}

function DashboardResults({ data }: { data: SpotifyDashboardData }) {
  const trackArtistShares = buildTrackArtistShares(data.tracks);
  const uniqueTrackArtists = countUniqueTrackArtists(data.tracks);

  return (
    <div className="space-y-8">
      <SummaryCards
        artistCount={data.artists.length}
        trackCount={data.tracks.length}
        uniqueTrackArtists={uniqueTrackArtists}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.82fr)_minmax(0,1.55fr)]">
        <TrackShareChart
          shares={trackArtistShares}
          trackCount={data.tracks.length}
        />
        <ArtistsSection artists={data.artists} />
      </div>

      <TracksSection tracks={data.tracks} />
    </div>
  );
}

function TimeRangeSelector({
  selected,
  onSelect,
}: {
  selected: SpotifyTimeRange;
  onSelect: (timeRange: SpotifyTimeRange) => void;
}) {
  return (
    <section
      aria-labelledby="spotify-time-range-heading"
      className="flex flex-col gap-4 rounded-2xl border border-neutral-800 bg-white/[0.025] p-4 lg:flex-row lg:items-center lg:justify-between"
    >
      <div>
        <h4
          id="spotify-time-range-heading"
          className="font-medium text-white"
        >
          Listening affinity window
        </h4>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Change the period to request a fresh Spotify ranking.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group">
        {timeRanges.map((option) => {
          const isSelected = selected === option.value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(option.value)}
              className={
                isSelected
                  ? 'min-h-11 rounded-xl bg-gradient-to-r from-emerald-300 to-emerald-400 px-4 py-2 text-sm font-semibold text-neutral-950 shadow-lg shadow-emerald-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b0d]'
                  : 'min-h-11 rounded-xl border border-neutral-700 bg-neutral-950/60 px-4 py-2 text-sm font-medium text-neutral-400 transition hover:border-violet-400/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300'
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SummaryCards({
  artistCount,
  trackCount,
  uniqueTrackArtists,
}: {
  artistCount: number;
  trackCount: number;
  uniqueTrackArtists: number;
}) {
  const summaries = [
    {
      label: 'Top artists displayed',
      value: artistCount,
      detail: 'Ordered by Spotify listening affinity',
      accent: 'text-emerald-300',
    },
    {
      label: 'Top tracks displayed',
      value: trackCount,
      detail: 'From the selected affinity window',
      accent: 'text-violet-300',
    },
    {
      label: 'Credited artists',
      value: uniqueTrackArtists,
      detail: 'Unique artists across the shown tracks',
      accent: 'text-cyan-300',
    },
  ];

  return (
    <section aria-label="Dashboard summary" className="grid gap-4 md:grid-cols-3">
      {summaries.map((summary) => (
        <div
          key={summary.label}
          className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-white/[0.055] to-transparent p-5 shadow-lg shadow-black/10"
        >
          <p className="text-sm text-neutral-400">{summary.label}</p>
          <p className={`mt-3 text-4xl font-semibold tracking-tight ${summary.accent}`}>
            {summary.value}
          </p>
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            {summary.detail}
          </p>
        </div>
      ))}
    </section>
  );
}

function TrackShareChart({
  shares,
  trackCount,
}: {
  shares: TrackArtistShare[];
  trackCount: number;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <section
      aria-labelledby="track-share-heading"
      className="rounded-2xl border border-neutral-800 bg-gradient-to-b from-violet-400/[0.06] to-transparent p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
        Track mix
      </p>
      <h4 id="track-share-heading" className="mt-2 text-xl font-semibold text-white">
        Share of top tracks by artist
      </h4>
      <p className="mt-2 text-xs leading-5 text-neutral-500">
        Each track is counted once using its first credited artist. This is not
        listening time or play count.
      </p>

      {shares.length > 0 ? (
        <>
          <div className="mx-auto mt-6 max-w-[17rem]">
            <svg
              viewBox="0 0 120 120"
              role="img"
              aria-labelledby="track-share-chart-title track-share-chart-description"
              className="h-auto w-full drop-shadow-[0_16px_24px_rgba(0,0,0,0.35)]"
            >
              <title id="track-share-chart-title">
                Share of top tracks by primary artist
              </title>
              <desc id="track-share-chart-description">
                {shares
                  .map(
                    (share) =>
                      `${share.label}: ${share.count} of ${trackCount} tracks`,
                  )
                  .join('. ')}
              </desc>
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="#262626"
                strokeWidth="14"
              />
              {shares.map((share, index) => {
                const segmentLength =
                  (share.percentage / 100) * circumference;
                const visibleLength = Math.max(segmentLength - 2, 0);
                const precedingLength = shares
                  .slice(0, index)
                  .reduce(
                    (total, precedingShare) =>
                      total +
                      (precedingShare.percentage / 100) * circumference,
                    0,
                  );

                return (
                  <circle
                    key={share.key}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={chartColors[index]}
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray={`${visibleLength} ${circumference - visibleLength}`}
                    strokeDashoffset={-precedingLength}
                    pathLength={circumference}
                    transform="rotate(-90 60 60)"
                    aria-hidden="true"
                  />
                );
              })}
              <text
                x="60"
                y="56"
                textAnchor="middle"
                className="fill-white text-[14px] font-semibold"
              >
                {trackCount}
              </text>
              <text
                x="60"
                y="69"
                textAnchor="middle"
                className="fill-neutral-400 text-[6px] uppercase tracking-wider"
              >
                top tracks
              </text>
            </svg>
          </div>

          <ul className="mt-6 space-y-3" aria-label="Track share legend">
            {shares.map((share, index) => (
              <li
                key={share.key}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-sm"
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold text-neutral-950"
                  style={{ backgroundColor: chartColors[index] }}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span className="truncate text-neutral-300">{share.label}</span>
                <span className="text-right text-neutral-500">
                  {share.count} {share.count === 1 ? 'track' : 'tracks'} ·{' '}
                  {Math.round(share.percentage)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <SectionEmptyState label="No top tracks were returned for this period." />
      )}
    </section>
  );
}

function ArtistsSection({ artists }: { artists: SpotifyDashboardArtist[] }) {
  return (
    <section
      aria-labelledby="spotify-artists-heading"
      className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-emerald-400/[0.055] via-transparent to-cyan-400/[0.035] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Ranked collection
          </p>
          <h4
            id="spotify-artists-heading"
            className="mt-2 text-xl font-semibold text-white"
          >
            Top artists
          </h4>
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            Rank is ordinal and does not represent minutes, plays, or a score.
          </p>
        </div>
        <span className="rounded-full border border-neutral-700 bg-black/20 px-3 py-1 text-xs text-neutral-400">
          {artists.length} shown
        </span>
      </div>

      {artists.length > 0 ? (
        <ol className="mt-6 grid gap-3 sm:grid-cols-2">
          {artists.map((artist, index) => (
            <li
              key={artist.spotifyUrl}
              className={`group relative flex min-w-0 items-center gap-4 overflow-hidden rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:bg-white/[0.055] ${
                index < 3
                  ? 'border-emerald-300/20 bg-emerald-300/[0.045]'
                  : 'border-neutral-800 bg-black/20'
              }`}
            >
              <span className="absolute right-3 top-2 text-3xl font-semibold tracking-tighter text-white/[0.065]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="relative w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-neutral-900 sm:w-20">
                {artist.imageUrl ? (
                  <img
                    src={artist.imageUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-square h-auto w-full object-contain"
                  />
                ) : (
                  <ArtworkPlaceholder label="Artist artwork unavailable" />
                )}
              </div>
              <div className="relative min-w-0 pr-5">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-300">
                  Rank {index + 1}
                </p>
                <a
                  href={artist.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block truncate font-medium text-white underline-offset-4 group-hover:text-emerald-200 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  {artist.name}
                  <span className="sr-only"> on Spotify</span>
                </a>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <SectionEmptyState label="No top artists were returned for this period." />
      )}
    </section>
  );
}

function TracksSection({ tracks }: { tracks: SpotifyDashboardTrack[] }) {
  return (
    <section
      aria-labelledby="spotify-tracks-heading"
      className="rounded-2xl border border-neutral-800 bg-white/[0.025] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
            Current rotation
          </p>
          <h4
            id="spotify-tracks-heading"
            className="mt-2 text-xl font-semibold text-white"
          >
            Top tracks
          </h4>
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            Spotify&apos;s affinity ranking for the selected period.
          </p>
        </div>
        <span className="rounded-full border border-neutral-700 bg-black/20 px-3 py-1 text-xs text-neutral-400">
          {tracks.length} shown
        </span>
      </div>

      {tracks.length > 0 ? (
        <ol className="mt-6 grid gap-3 xl:grid-cols-2">
          {tracks.map((track, index) => (
            <li
              key={track.spotifyUrl}
              className="group flex min-w-0 items-center gap-3 rounded-2xl border border-neutral-800 bg-black/20 p-3 transition hover:border-violet-300/25 hover:bg-violet-300/[0.045] sm:gap-4"
            >
              <span className="w-7 shrink-0 text-center text-sm font-semibold text-neutral-500">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-neutral-900 sm:w-20">
                {track.album.imageUrl ? (
                  <img
                    src={track.album.imageUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-square h-auto w-full object-contain"
                  />
                ) : (
                  <ArtworkPlaceholder label="Album artwork unavailable" compact />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <a
                  href={track.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-medium text-white underline-offset-4 group-hover:text-violet-200 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                >
                  {track.name}
                  <span className="sr-only"> on Spotify</span>
                </a>
                <p className="mt-1 truncate text-sm text-neutral-400">
                  {track.artists.map((artist, artistIndex) => (
                    <span key={artist.spotifyUrl}>
                      {artistIndex > 0 && ', '}
                      <a
                        href={artist.spotifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-4 hover:text-white hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
                      >
                        {artist.name}
                      </a>
                    </span>
                  ))}
                </p>
                <p className="mt-1 truncate text-xs text-neutral-500">
                  {track.album.name}
                </p>
              </div>
              <span
                className="hidden shrink-0 text-neutral-600 transition group-hover:text-violet-300 sm:block"
                aria-hidden="true"
              >
                ↗
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <SectionEmptyState label="No top tracks were returned for this period." />
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-white/[0.025] p-10 text-center">
      <div
        className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-neutral-700 border-t-emerald-300 motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p className="mt-5 text-sm text-neutral-300">Loading Spotify dashboard...</p>
      <p className="mt-2 text-xs text-neutral-500">
        Requesting your top-item rankings securely.
      </p>
    </div>
  );
}

function DisconnectedState() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.08] via-transparent to-violet-400/[0.08] p-7 text-center sm:p-10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
        <MusicAnalyticsIcon />
      </div>
      <h4 className="mt-5 text-2xl font-semibold text-white">Connect Spotify</h4>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-400">
        Authorize read-only access to your top artists and tracks. Spotify
        Development Mode limits this demo to accounts approved for the app.
      </p>
      <a
        href="/api/spotify/login"
        className="mt-7 inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-emerald-300 to-emerald-400 px-6 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-emerald-950/30 transition hover:from-emerald-200 hover:to-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080b0d]"
      >
        Connect Spotify
      </a>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: SpotifyDashboardRequestError;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-900/80 bg-rose-950/25 p-7 text-center sm:p-10">
      <h4 className="text-xl font-semibold text-white">
        {error.kind === 'restricted'
          ? 'Spotify account not authorized'
          : error.kind === 'rate-limit'
            ? 'Spotify request limit reached'
            : 'Dashboard unavailable'}
      </h4>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-rose-100/80">
        {error.message}
      </p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 rounded-xl bg-white px-5 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Try Again
        </button>
        {error.kind === 'restricted' && (
          <a
            href="/api/spotify/login"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-800 px-5 py-2 text-sm font-medium text-white transition hover:bg-rose-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            Connect Another Account
          </a>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-700 bg-white/[0.025] p-10 text-center">
      <h4 className="text-lg font-semibold text-white">No listening data found</h4>
      <p className="mt-2 text-sm leading-6 text-neutral-400">
        Spotify did not return top artists or tracks for this period. Try a
        longer listening range.
      </p>
    </div>
  );
}

function SectionEmptyState({ label }: { label: string }) {
  return (
    <p className="mt-6 rounded-xl border border-dashed border-neutral-700 bg-black/20 p-5 text-sm text-neutral-500">
      {label}
    </p>
  );
}

function ArtworkPlaceholder({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex aspect-square items-center justify-center bg-neutral-900 px-2 text-center text-neutral-600 ${compact ? 'text-[10px]' : 'text-xs'}`}
    >
      {label}
    </div>
  );
}

function MusicAnalyticsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M4 15v-3m4 6V8m4 8V5m4 13v-7m4 4V9" strokeLinecap="round" />
    </svg>
  );
}

function getTimeRangeLabel(timeRange: SpotifyTimeRange): string {
  return (
    timeRanges.find((option) => option.value === timeRange)?.label ??
    'the selected period'
  );
}
