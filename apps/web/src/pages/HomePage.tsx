import { Link } from 'react-router';
import { buttonClass } from '../components/ui/buttonClass';
import { HowItWorksSteps } from '../features/home/HowItWorksSteps';
import { MyTripsList } from '../features/home/MyTripsList';

/** frontend-spec §3.1 — hero, device trips (F11), how it works (F13). */
export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="space-y-4 py-6 text-center sm:py-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Plan a trip together</h1>
        <p className="mx-auto max-w-xl text-lg text-slate-600 dark:text-slate-300">
          One shared plan for the whole group — no sign-up, just links.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/new" className={buttonClass('primary')}>
            Plan a trip
          </Link>
          <Link to="/explore" className={buttonClass('secondary')}>
            Browse trips
          </Link>
        </div>
      </section>

      <MyTripsList />

      <section aria-labelledby="how-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="how-heading" className="text-lg font-semibold">
            How it works
          </h2>
          <Link
            to="/how-it-works"
            className="text-sm text-teal-700 hover:underline dark:text-teal-300"
          >
            Read the full guide →
          </Link>
        </div>
        <HowItWorksSteps compact />
      </section>

      <footer className="flex flex-wrap justify-center gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500 dark:border-slate-800">
        <Link to="/recover" className="hover:underline">
          Lost your organiser link?
        </Link>
        <Link to="/how-it-works" className="hover:underline">
          How it works
        </Link>
      </footer>
    </div>
  );
}
