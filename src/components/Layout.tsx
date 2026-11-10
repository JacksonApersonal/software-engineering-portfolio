import { useRef } from 'react';
import { Outlet } from 'react-router';
import { Footer } from './Footer';
import { Navbar } from './Navbar';
import { RouteExperience } from './RouteExperience';

export function Layout() {
  const mainContentRef = useRef<HTMLElement>(null);

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <a
        href="#main-content"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-white px-4 py-3 font-medium text-neutral-950 shadow-lg transition focus:translate-y-0"
      >
        Skip to main content
      </a>

      <Navbar />

      <RouteExperience mainContentRef={mainContentRef} />

      <main
        id="main-content"
        ref={mainContentRef}
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl flex-1 scroll-mt-6 px-6 py-12 focus:outline-none"
      >
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
