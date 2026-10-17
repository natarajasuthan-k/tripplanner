import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toaster';
import { HowItWorksSteps } from '../features/home/HowItWorksSteps';
import { resetTips } from '../lib/preferences';

const SECTIONS = [
  ['what', 'What Trip Planner does'],
  ['links', 'The three links'],
  ['together', 'Planning together'],
  ['ideas', 'Ideas & inspiration'],
  ['privacy', 'Publishing & privacy'],
  ['ends', 'When a trip ends'],
  ['faq', 'FAQ'],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-20 space-y-3">
      <h2 id={`${id}-heading`} className="text-xl font-semibold">
        {title}
      </h2>
      <div className="space-y-3 leading-relaxed text-slate-700 dark:text-slate-300">{children}</div>
    </section>
  );
}

const PERMISSIONS: [string, string, string, string][] = [
  ['View the plan', '✅', '✅', '✅'],
  ['Edit day plans', '✅', '✅', '—'],
  ['Copy & share the edit / view links', '✅', '✅', '—'],
  ['See the organiser link', '✅', '—', '—'],
  ['Change name, destination or dates', '✅', '—', '—'],
  ['Publish or un-publish', '✅', '—', '—'],
  ['Delete the trip', '✅', 'Ask the organiser', '—'],
];

/** frontend-spec §3.7 — full guide (F13, AC16.2, AC16.4). */
export default function HowItWorksPage() {
  const toast = useToast();
  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
        <nav aria-label="On this page">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {SECTIONS.map(([id, title]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-teal-700 hover:underline dark:text-teal-300">
                  {title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <Section id="what" title="What Trip Planner does">
        <p>
          Trip Planner keeps your group’s plans in one place. Create a trip, share a link, and
          everyone adds ideas day by day — no accounts, no sign-up.
        </p>
        <HowItWorksSteps />
      </Section>

      <Section id="links" title="The three links">
        <p>
          Every trip has three links. Whoever has a link can do what that link allows — so share
          each one with the right people.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 pr-3 font-semibold">What you can do</th>
                <th className="py-2 pr-3 font-semibold">Organiser</th>
                <th className="py-2 pr-3 font-semibold">Edit</th>
                <th className="py-2 font-semibold">View-only</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map(([what, o, e, v]) => (
                <tr key={what} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="py-2 pr-3">{what}</td>
                  <td className="py-2 pr-3">{o}</td>
                  <td className="py-2 pr-3">{e}</td>
                  <td className="py-2">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <strong>Share the edit link</strong> with fellow travellers, the{' '}
          <strong>view-only link</strong> with family and friends, and keep the{' '}
          <strong>organiser link</strong> to yourself.
        </p>
      </Section>

      <Section id="together" title="Planning together">
        <p>
          Each day has its own notes. Changes <strong>save automatically</strong> about a second
          after you stop typing — watch for “Saved”. Edits from others appear within about 10
          seconds.
        </p>
        <p>
          When someone else is editing a day you’ll see “<em>name</em> is editing…”. You can still
          edit. If you both save the same day, we’ll show both versions and you choose which to keep
          — nothing is silently lost.
        </p>
      </Section>

      <Section id="ideas" title="Ideas & inspiration">
        <p>
          The <strong>Ideas</strong> panel suggests places of interest for your destination — use
          “Add” to drop one into a day. It also lists earlier published trips to the same place.
          Found a plan you like under Explore? Use <strong>Copy this plan</strong> to start a new,
          private trip from it with your own dates.
        </p>
      </Section>

      <Section id="privacy" title="Publishing & privacy">
        <p>
          New trips are <strong>private</strong> — only people with a link can open them. The
          organiser can <strong>publish</strong> a trip so anyone can browse it read-only under
          Explore; its links are never shown to visitors. Un-publish at any time.
        </p>
        <p>
          We store the display name you type. If you give an email when creating a trip, we use it
          only to send you the organiser link — the address itself is never stored or shown. Your
          trips are also remembered in this browser.
        </p>
      </Section>

      <Section id="ends" title="When a trip ends">
        <p>
          After the last day has passed the trip is marked <strong>Completed</strong> and becomes
          read-only, so your record of the trip stays as it was. The organiser can still delete it.
        </p>
      </Section>

      <Section id="faq" title="FAQ">
        <dl className="space-y-4">
          <div>
            <dt className="font-semibold">I lost my organiser link.</dt>
            <dd>
              Check “Your trips on this device” on the home page. On another device, use{' '}
              <Link to="/recover" className="text-teal-700 underline dark:text-teal-300">
                Forgot my link
              </Link>{' '}
              — if you gave your email when creating the trip, we’ll send the link again.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Can I stop someone from editing?</dt>
            <dd>Give them the view-only link instead of the edit link.</dd>
          </div>
          <div>
            <dt className="font-semibold">How do I delete a trip?</dt>
            <dd>
              Open the organiser link and choose “Delete trip”. Travellers can ask the organiser to
              delete it with “Request deletion”.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Is my data private?</dt>
            <dd>
              Private trips can only be opened with their links, which are long random codes that
              can’t be guessed.
            </dd>
          </div>
        </dl>
      </Section>

      <section className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="mb-1 font-semibold">Tips</h2>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
          Bring back the first-visit tips you’ve dismissed.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            resetTips();
            toast.show('Tips will show again');
          }}
        >
          Show tips again
        </Button>
      </section>
    </article>
  );
}
