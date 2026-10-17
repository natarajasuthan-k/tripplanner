import { Link } from 'react-router';

/** frontend-spec §3.8 — unknown route, invalid link or deleted trip (AC2.5). */
export default function NotFoundPage() {
  return (
    <section className="space-y-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">Trip not found</h1>
      <p className="text-slate-600 dark:text-slate-300">
        The link may be wrong or the trip was deleted.
      </p>
      <div className="flex justify-center gap-3">
        <Link to="/" className="rounded-lg border border-slate-300 px-4 py-2 dark:border-slate-700">
          Go home
        </Link>
        <Link to="/new" className="rounded-lg bg-teal-600 px-4 py-2 text-white">
          Create a trip
        </Link>
      </div>
    </section>
  );
}
