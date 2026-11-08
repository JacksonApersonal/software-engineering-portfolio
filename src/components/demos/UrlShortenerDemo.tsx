import { useId, useState, type FormEvent } from 'react';
import { MAX_URL_LENGTH } from '../../lib/urlShortener';
import {
  getDestinationValidationError,
  requestShortUrl,
  ShortenUrlRequestError,
  type ShortenUrlResult,
} from '../../lib/urlShortenerClient';

type StatusTone = 'neutral' | 'success' | 'error';

export function UrlShortenerDemo() {
  const inputId = useId();
  const helpId = useId();
  const statusId = useId();
  const [destination, setDestination] = useState('');
  const [result, setResult] = useState<ShortenUrlResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    'Ready to create a short link.',
  );
  const [statusTone, setStatusTone] = useState<StatusTone>('neutral');
  const [hasValidationError, setHasValidationError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const validationError = getDestinationValidationError(destination);

    if (validationError) {
      setHasValidationError(true);
      setStatusTone('error');
      setStatusMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setHasValidationError(false);
    setStatusTone('neutral');
    setStatusMessage('Creating your short link...');
    setResult(null);

    try {
      const shortLink = await requestShortUrl(destination.trim());
      setResult(shortLink);
      setStatusTone('success');
      setStatusMessage('Short link created successfully.');
    } catch (error) {
      setStatusTone('error');
      setStatusMessage(
        error instanceof ShortenUrlRequestError
          ? error.message
          : 'The URL shortener is temporarily unavailable. Please try again later.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyShortUrl() {
    if (!result) {
      return;
    }

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard API unavailable.');
      }

      await navigator.clipboard.writeText(result.shortUrl);
      setStatusTone('success');
      setStatusMessage('Short link copied to the clipboard.');
    } catch {
      setStatusTone('error');
      setStatusMessage(
        'The link could not be copied automatically. Select and copy it manually.',
      );
    }
  }

  const statusClassName =
    statusTone === 'success'
      ? 'border-emerald-900 bg-emerald-950/40 text-emerald-200'
      : statusTone === 'error'
        ? 'border-rose-900 bg-rose-950/40 text-rose-200'
        : 'border-neutral-800 bg-neutral-950 text-neutral-300';

  return (
    <div className="w-full space-y-6">
      <form
        noValidate
        aria-busy={isSubmitting}
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <div>
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-neutral-200"
          >
            Destination URL
          </label>

          <p id={helpId} className="mt-2 text-sm leading-6 text-neutral-500">
            Enter a complete public URL beginning with http:// or https://.
          </p>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id={inputId}
              type="url"
              inputMode="url"
              autoComplete="url"
              maxLength={MAX_URL_LENGTH}
              value={destination}
              onChange={(event) => {
                setDestination(event.target.value);
                setHasValidationError(false);
              }}
              aria-describedby={`${helpId} ${statusId}`}
              aria-invalid={hasValidationError}
              disabled={isSubmitting}
              placeholder="https://example.com/article"
              className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-700 disabled:cursor-not-allowed disabled:text-neutral-500"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="shrink-0 rounded-xl bg-white px-5 py-3 font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400 sm:min-w-36"
            >
              {isSubmitting ? 'Shortening...' : 'Shorten URL'}
            </button>
          </div>
        </div>
      </form>

      <p
        id={statusId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`rounded-xl border px-4 py-3 text-sm ${statusClassName}`}
      >
        {statusMessage}
      </p>

      {result && (
        <section className="min-w-0 rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 sm:p-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
            Your Short Link
          </p>

          <div className="mt-4 min-w-0 space-y-4">
            <div className="min-w-0">
              <label
                htmlFor={`${inputId}-result`}
                className="text-sm text-neutral-400"
              >
                Shareable URL
              </label>

              <input
                id={`${inputId}-result`}
                readOnly
                value={result.shortUrl}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-2 w-full min-w-0 rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 font-mono text-sm text-white outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-700"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={copyShortUrl}
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200"
              >
                Copy Link
              </button>

              <a
                href={result.shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-neutral-700 px-4 py-2 text-center text-sm font-medium text-white transition hover:border-neutral-500 hover:bg-neutral-900"
              >
                Open Short Link
              </a>
            </div>

            <div className="min-w-0 border-t border-neutral-800 pt-4">
              <p className="text-sm text-neutral-500">Redirect destination</p>
              <p className="mt-2 break-all text-sm leading-6 text-neutral-300">
                {result.destination}
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
