import { Link } from 'react-router';

export function Footer() {
  return (
    <footer className="border-t border-neutral-800 bg-neutral-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            to="/"
            className="text-base font-semibold tracking-tight text-white"
          >
            Jackson Acord
          </Link>

          <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
            Software engineer focused on building reliable applications,
            backend systems, developer tooling, and well-tested software across
            a range of technologies.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="mailto:jacord2001@gmail.com"
            className="rounded-xl border border-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white"
          >
            Email
          </a>

          <a
            href="https://linkedin.com/in/jackson-acord-b0baa2262"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white"
          >
            LinkedIn
          </a>

          <a
            href="https://github.com/JacksonApersonal"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white"
          >   
            GitHub
          </a>

          <Link
            to="/resume"
            className="rounded-xl border border-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white"
          >
            Resume
          </Link>
        </div>
      </div>
    </footer>
  );
}
