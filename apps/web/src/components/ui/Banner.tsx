import { AlertTriangle, Info } from 'lucide-react';
import type { ReactNode } from 'react';

type Variant = 'info' | 'warning' | 'action';

const STYLES: Record<Variant, string> = {
  info: 'border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
  warning:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200',
  action:
    'border-red-300 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200',
};

export function Banner({
  variant = 'info',
  children,
  actions,
}: {
  variant?: Variant;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const Icon = variant === 'info' ? Info : AlertTriangle;
  return (
    <div
      role={variant === 'action' ? 'alert' : 'status'}
      className={`flex flex-col gap-3 rounded-xl border p-3 text-sm sm:flex-row sm:items-center ${STYLES[variant]}`}
    >
      <div className="flex flex-1 items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>{children}</div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
