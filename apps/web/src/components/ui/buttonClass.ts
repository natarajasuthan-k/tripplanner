export type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300',
  secondary:
    'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400',
  ghost: 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm sm:text-base',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}
