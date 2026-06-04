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
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-lg font-semibold tracking-tight text-white">
          Jackson Acord
        </Link>

        <div className="flex gap-6 text-sm">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive
                  ? 'font-medium text-white'
                  : 'text-neutral-400 transition hover:text-white'
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