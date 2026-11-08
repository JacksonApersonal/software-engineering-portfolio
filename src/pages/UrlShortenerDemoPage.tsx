import { UrlShortenerDemo } from '../components/demos/UrlShortenerDemo';

export function UrlShortenerDemoPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
          Interactive Demo
        </p>

        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
          URL Shortener
        </h1>

        <p className="mt-5 max-w-3xl leading-7 text-neutral-400">
          Create a compact link for a public HTTP or HTTPS destination. The
          server validates each request, reserves a unique code, and stores the
          redirect mapping in Redis.
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 sm:p-6">
        <UrlShortenerDemo />
      </section>
    </section>
  );
}
