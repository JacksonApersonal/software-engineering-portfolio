import { useEffect } from 'react';
import { Link, isRouteErrorResponse, useRouteError } from 'react-router';

export function NotFoundPage() {
  return (
    <ErrorContent
      eyebrow="404"
      title="Page not found"
      description="The page you requested does not exist or may have moved."
    />
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  useEffect(() => {
    document.title = isNotFound
      ? 'Page Not Found | Jackson Acord'
      : 'Something Went Wrong | Jackson Acord';
  }, [isNotFound]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 py-16 text-neutral-100">
      <ErrorContent
        eyebrow={isNotFound ? '404' : 'Error'}
        title={isNotFound ? 'Page not found' : 'Something went wrong'}
        description={
          isNotFound
            ? 'The page you requested does not exist or may have moved.'
            : 'The portfolio could not display this page. Return home or continue to the project list.'
        }
      />
    </main>
  );
}

function ErrorContent({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 text-center sm:p-10">
      <p className="text-sm font-medium uppercase tracking-[0.25em] text-neutral-500">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
        {title}
      </h1>
      <p className="mt-4 leading-7 text-neutral-400">{description}</p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 py-2 font-medium text-neutral-950 transition hover:bg-neutral-200"
        >
          Return Home
        </Link>
        <Link
          to="/projects"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-neutral-700 px-5 py-2 font-medium text-white transition hover:border-neutral-500 hover:bg-neutral-900"
        >
          View Projects
        </Link>
      </div>
    </section>
  );
}
