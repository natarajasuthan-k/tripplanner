import { Link } from 'react-router';
import { forgetTrip, useMyTrips } from '../lib/myTrips';
import { buttonClass } from './ui/buttonClass';

/** "Trip not found" body — invalid link, unknown route or deleted trip (AC2.5, AC13.2). */
export function NotFoundView({ token }: { token?: string }) {
  const myTrips = useMyTrips();
  const remembered = token ? myTrips.find((t) => t.token === token) : undefined;

  return (
    <section className="space-y-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">Trip not found</h1>
      <p className="text-slate-600 dark:text-slate-300">
        The link may be wrong or the trip was deleted.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {remembered && (
          <button
            type="button"
            onClick={() => forgetTrip(remembered.token)}
            className={buttonClass('secondary')}
          >
            Remove “{remembered.name}” from my trips
          </button>
        )}
        <Link to="/" className={buttonClass('secondary')}>
          Go home
        </Link>
        <Link to="/new" className={buttonClass('primary')}>
          Create a trip
        </Link>
      </div>
    </section>
  );
}
