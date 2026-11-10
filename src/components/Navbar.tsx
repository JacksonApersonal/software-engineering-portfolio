import { Link, NavLink } from 'react-router';

const navLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'About' },
  { to: '/resume', label: 'Resume' },
];

export function Navbar() {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <nav
        aria-label="Primary navigation"
        className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <Link
          to="/"
          className="inline-flex min-h-11 items-center rounded-lg text-lg font-semibold tracking-tight text-white"
        >
          Jackson Acord
        </Link>

        <div className="flex flex-wrap gap-3 text-sm sm:gap-6">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive
                  ? 'inline-flex min-h-11 items-center rounded-lg bg-white px-3 py-2 font-medium text-neutral-950'
                  : 'inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-neutral-400 transition hover:bg-neutral-900 hover:text-white'
              }
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
