import { Plane } from 'lucide-react';
import { Suspense } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { OfflineBanner } from './OfflineBanner';
import { ThemeToggle } from './ThemeToggle';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2 py-1 text-sm font-medium ${
    isActive
      ? 'text-teal-700 dark:text-teal-300'
      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
  }`;

/** Top bar + main content (frontend-spec §4). */
export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <OfflineBanner />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        {/* Mobile: logo + theme on row 1, nav on row 2. sm+: single row. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold whitespace-nowrap">
            <Plane className="size-5 text-teal-600 dark:text-teal-400" aria-hidden />
            Trip Planner
          </Link>
          <nav
            aria-label="Main"
            className="order-3 flex w-full items-center gap-1 whitespace-nowrap sm:order-2 sm:ml-auto sm:w-auto sm:gap-2"
          >
            <NavLink to="/explore" className={navClass}>
              Explore
            </NavLink>
            <NavLink to="/how-it-works" className={navClass}>
              How it works
            </NavLink>
            <Link
              to="/new"
              className="ml-auto rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 sm:ml-0 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300"
            >
              New trip
            </Link>
          </nav>
          <div className="order-2 ml-auto sm:order-3 sm:ml-0">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
