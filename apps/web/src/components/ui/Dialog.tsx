import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import type { ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Prevent closing via Escape / outside click (e.g. required input). */
  dismissible?: boolean;
}

/** Accessible modal (Radix: focus trap, Escape, aria wiring) — frontend-spec §8. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  dismissible = true,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm" />
        <RadixDialog.Content
          onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
          onPointerDownOutside={(e) => !dismissible && e.preventDefault()}
          className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-800"
        >
          <div className="mb-3 flex items-start gap-3">
            <RadixDialog.Title className="flex-1 text-lg font-semibold">{title}</RadixDialog.Title>
            {dismissible && (
              <RadixDialog.Close
                aria-label="Close"
                className="-m-1 rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="size-5" aria-hidden />
              </RadixDialog.Close>
            )}
          </div>
          {description ? (
            <RadixDialog.Description className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              {description}
            </RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
