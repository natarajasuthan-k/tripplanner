import { format, parseISO } from 'date-fns';

/** "5 Dec – 7 Dec 2026" (year shown once when both dates share it). */
export function formatShortRange(from: string, to: string) {
  const f = parseISO(from);
  const t = parseISO(to);
  if (from === to) return format(f, 'd MMM yyyy');
  const sameYear = f.getFullYear() === t.getFullYear();
  return `${format(f, sameYear ? 'd MMM' : 'd MMM yyyy')} – ${format(t, 'd MMM yyyy')}`;
}
