import { Link } from 'react-router';

export function Navbar() {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-lg font-semibold tracking-tight text-white">
          Jackson Acord
        </Link>

        <div className="flex gap-6 text-sm text-neutral-400">
          <Link to="/" className="transition hover:text-white">
            Home
          </Link>

          <Link to="/projects" className="transition hover:text-white">
            Projects
          </Link>

          <Link to="/about" className="transition hover:text-white">
            About
          </Link>
          
          <Link to="/resume" className="transition hover:text-white">
            Resume
          </Link>
        </div>
      </nav>
    </header>
  );
}