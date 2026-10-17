export type BadgeKind = 'private' | 'published' | 'completed' | 'view-only' | MyRoleBadge;
type MyRoleBadge = 'organiser' | 'editor' | 'viewer';

const LABELS: Record<BadgeKind, string> = {
  private: 'Private',
  published: 'Published',
  completed: 'Completed',
  'view-only': 'View only',
  organiser: 'Organiser',
  editor: 'Editor',
  viewer: 'Viewer',
};

const STYLES: Record<BadgeKind, string> = {
  private: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  published: 'bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300',
  completed: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-300',
  'view-only': 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  organiser: 'bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300',
  editor: 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300',
  viewer: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export function StatusBadge({ kind }: { kind: BadgeKind }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[kind]}`}>
      {LABELS[kind]}
    </span>
  );
}
