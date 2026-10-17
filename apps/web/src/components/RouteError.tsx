import { Button } from './ui/Button';

/** Page-level error boundary (frontend-spec §9 "Unexpected crash"). */
export function RouteError() {
  return (
    <section className="space-y-3 py-12 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-slate-600 dark:text-slate-300">Please reload the page and try again.</p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </section>
  );
}
