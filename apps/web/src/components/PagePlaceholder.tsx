import type { ReactNode } from 'react';

/** Temporary page body used by scaffolded routes until each feature is implemented. */
export function PagePlaceholder({
  title,
  spec,
  children,
}: {
  title: string;
  spec: string;
  children?: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
      <p className="text-sm text-slate-600 dark:text-slate-400">Spec: {spec}</p>
    </section>
  );
}
