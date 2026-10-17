import { Link } from 'react-router';
import { PagePlaceholder } from '../components/PagePlaceholder';

export default function HomePage() {
  return (
    <PagePlaceholder title="Plan a trip together" spec="frontend-spec §3.1 (F1, F4, F11, F13)">
      <p className="text-slate-600 dark:text-slate-300">
        One shared plan for the whole group — no sign-up, just links.
      </p>
      <div className="flex gap-3">
        <Link to="/new" className="rounded-lg bg-teal-600 px-4 py-2 font-medium text-white">
          Plan a trip
        </Link>
        <Link
          to="/explore"
          className="rounded-lg border border-slate-300 px-4 py-2 font-medium dark:border-slate-700"
        >
          Browse trips
        </Link>
      </div>
    </PagePlaceholder>
  );
}
