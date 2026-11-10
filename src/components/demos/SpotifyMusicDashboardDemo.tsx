import { useEffect, useRef, useState } from 'react';
import {
  disconnectSpotify,
  requestSpotifyDashboard,
  SpotifyDashboardRequestError,
  type SpotifyDashboardData,
  type SpotifyDashboardTrack,
  type SpotifyTimeRange,
} from '../../lib/spotifyClient';

const timeRanges: Array<{
  value: SpotifyTimeRange;
  label: string;
}> = [
  { value: 'short_term', label: 'Last 4 Weeks' },
  { value: 'medium_term', label: 'Last 6 Months' },
  { value: 'long_term', label: 'Last 12 Months' },
];

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
    <div className="w-full space-y-6" aria-busy={isLoading || isDisconnecting}>
      <div className="flex flex-col gap-5 border-b border-neutral-800 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-emerald-400">
            Spotify Web API
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Your listening dashboard
          </h3>
          <p className="mt-3 text-sm leading-6 text-neutral-400">
            Explore the artists and tracks Spotify associates with your recent
            listening. Only top-item data is requested.
          </p>
        </div>

        {showDisconnect && (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="shrink-0 rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-600"
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        )}
      </div>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </p>

      {isLoading ? (
        <LoadingState />
      ) : isDisconnected ? (
        <DisconnectedState />
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={handleRetry}
        />
      ) : data ? (
        <div className="space-y-8">
          <TimeRangeSelector
            selected={timeRange}
            onSelect={handleTimeRangeSelect}
          />

          {hasResults ? (
            <div className="space-y-10">
              <ArtistsSection artists={data.artists} />
              <TracksSection tracks={data.tracks} />
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      ) : null}

      <p className="border-t border-neutral-800 pt-5 text-xs leading-5 text-neutral-500">
        Listening data and artwork are provided by Spotify. Artist and track
        links open their official pages on Spotify. No listening data is stored
        in this browser.
      </p>
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
    <section aria-labelledby="spotify-time-range-heading">
      <h4
        id="spotify-time-range-heading"
        className="text-sm font-medium text-neutral-200"
      >
        Listening period
      </h4>
      <div className="mt-3 flex flex-wrap gap-2">
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
                  ? 'rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950'
                  : 'rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-400 transition hover:border-neutral-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400'
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

function ArtistsSection({
  artists,
}: {
  artists: SpotifyDashboardData['artists'];
}) {
  return (
    <section aria-labelledby="spotify-artists-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Ranked by listening affinity</p>
          <h4
            id="spotify-artists-heading"
            className="mt-1 text-xl font-semibold text-white"
          >
            Top artists
          </h4>
        </div>
        <span className="text-sm text-neutral-500">{artists.length} shown</span>
      </div>

      {artists.length > 0 ? (
        <ol className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {artists.map((artist, index) => (
            <li
              key={artist.spotifyUrl}
              className="min-w-0 rounded-xl border border-neutral-800 bg-neutral-950/80 p-3"
            >
              <span className="text-xs font-medium text-neutral-500">
                #{index + 1}
              </span>
              <div className="mt-2 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
                {artist.imageUrl ? (
                  <img
                    src={artist.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-auto w-full"
                  />
                ) : (
                  <ArtworkPlaceholder label="Artist artwork unavailable" />
                )}
              </div>
              <a
                href={artist.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 block break-words text-sm font-medium text-white underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
              >
                {artist.name}
                <span className="sr-only"> on Spotify</span>
              </a>
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
    <section aria-labelledby="spotify-tracks-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500">Ranked by listening affinity</p>
          <h4
            id="spotify-tracks-heading"
            className="mt-1 text-xl font-semibold text-white"
          >
            Top tracks
          </h4>
        </div>
        <span className="text-sm text-neutral-500">{tracks.length} shown</span>
      </div>

      {tracks.length > 0 ? (
        <ol className="mt-5 space-y-3">
          {tracks.map((track, index) => (
            <li
              key={track.spotifyUrl}
              className="flex min-w-0 items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950/80 p-3 sm:gap-4"
            >
              <span className="w-6 shrink-0 text-center text-sm font-medium text-neutral-500">
                {index + 1}
              </span>
              <div className="w-16 shrink-0 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 sm:w-20">
                {track.album.imageUrl ? (
                  <img
                    src={track.album.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-auto w-full"
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
                  className="block truncate font-medium text-white underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
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
                        className="underline-offset-4 hover:text-white hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
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
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-8 text-center">
      <div
        className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-emerald-400 motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p className="mt-4 text-sm text-neutral-300">Loading Spotify dashboard...</p>
    </div>
  );
}

function DisconnectedState() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 p-6 text-center sm:p-8">
      <h4 className="text-xl font-semibold text-white">Connect Spotify</h4>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-400">
        Authorize read-only access to your top artists and tracks. Spotify
        Development Mode limits this demo to accounts approved for the app.
      </p>
      <a
        href="/api/spotify/login"
        className="mt-6 inline-flex rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
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
    <div className="rounded-xl border border-rose-900 bg-rose-950/30 p-6 text-center sm:p-8">
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
          className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Try Again
        </button>
        {error.kind === 'restricted' && (
          <a
            href="/api/spotify/login"
            className="rounded-xl border border-rose-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
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
    <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-950/60 p-8 text-center">
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
    <p className="mt-5 rounded-xl border border-dashed border-neutral-800 p-5 text-sm text-neutral-500">
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

function getTimeRangeLabel(timeRange: SpotifyTimeRange): string {
  return (
    timeRanges.find((option) => option.value === timeRange)?.label ??
    'the selected period'
  );
}
