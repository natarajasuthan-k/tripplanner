import { Eye, KeyRound, MapPinned, Pencil, Share2, Sparkles, Users } from 'lucide-react';

const STEPS = [
  { Icon: MapPinned, title: 'Create a trip', text: 'Pick a name, a destination and your dates.' },
  { Icon: Share2, title: 'Share the links', text: 'Send the edit link to fellow travellers.' },
  {
    Icon: Users,
    title: 'Plan together',
    text: 'Everyone adds ideas day by day — it saves automatically.',
  },
  {
    Icon: Sparkles,
    title: 'Publish for inspiration',
    text: 'Optionally share your plan with everyone.',
  },
];

const LINKS = [
  {
    Icon: KeyRound,
    title: 'Organiser link',
    text: 'Full control: edit, share, publish, delete. Keep it private.',
  },
  { Icon: Pencil, title: 'Edit link', text: 'For fellow travellers — they can edit every day.' },
  {
    Icon: Eye,
    title: 'View-only link',
    text: 'For family and friends — they can look, not touch.',
  },
];

/** "How it works" steps + the three-links explainer (F13, AC16.1). */
export function HowItWorksSteps({ compact = false }: { compact?: boolean }) {
  return (
    <div className="space-y-6">
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ Icon, title, text }, i) => (
          <li
            key={title}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-teal-600 text-sm font-semibold text-white dark:bg-teal-400 dark:text-slate-950">
                {i + 1}
              </span>
              <Icon className="size-4 text-teal-600 dark:text-teal-400" aria-hidden />
            </div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{text}</p>
          </li>
        ))}
      </ol>
      <div>
        <h3 className={compact ? 'mb-2 font-semibold' : 'mb-3 text-lg font-semibold'}>
          Three links, three kinds of access
        </h3>
        <ul className="grid gap-3 sm:grid-cols-3">
          {LINKS.map(({ Icon, title, text }) => (
            <li
              key={title}
              className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <Icon
                className="mt-0.5 size-5 shrink-0 text-teal-600 dark:text-teal-400"
                aria-hidden
              />
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
