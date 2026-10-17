// Trip workspace for /o, /e and /v links — frontend-spec §3.3–3.4. The server-reported role
// decides what is shown; the URL prefix is only a hint.
import type { Day, Place, TripResponse } from '@tripplanner/shared';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { CalendarDays, EyeOff, Globe, MapPin, Pencil, Share2, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { NotFoundView } from '../components/NotFoundView';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useToast } from '../components/ui/Toaster';
import {
  deleteTrip,
  dismissDeleteRequests,
  requestDeletion,
  setPublished,
  tripKey,
  useTripQuery,
} from '../features/trip/api';
import { appendToDay, placeLine } from '../features/trip/dayActions';
import { EditTripDialog } from '../features/trip/EditTripDialog';
import { SidePanel } from '../features/trip/SidePanel';
import type { CreatedState } from './CreateTripPage';
import { DayCard } from '../features/trip/DayCard';
import { DeleteRequestsBanner } from '../features/trip/DeleteRequestsBanner';
import { DisplayNamePrompt } from '../features/trip/DisplayNamePrompt';
import { RoleTip } from '../features/trip/RoleTip';
import { ShareLinksDialog } from '../features/trip/ShareLinksDialog';
import { hasUnsaved, useHasUnsaved } from '../features/trip/unsaved';
import { ApiError, isApiError } from '../lib/api';
import { forgetTrip, rememberTrip } from '../lib/myTrips';
import { setDisplayName, useDisplayName } from '../lib/preferences';

export default function TripPage() {
  const { token = '' } = useParams();
  const query = useTripQuery(token);

  // A 404 wins over cached data: the trip was deleted while open (AC2.5, AC7.1).
  if (query.error instanceof ApiError && query.error.status === 404) {
    return <NotFoundView token={token} />;
  }
  // Other refetch errors keep showing the last good data.
  if (query.data) return <TripWorkspace token={token} data={query.data} />;
  if (query.error) {
    return (
      <section className="space-y-3 py-12 text-center">
        <h1 className="text-xl font-semibold">Couldn’t load this trip</h1>
        <p className="text-slate-600 dark:text-slate-300">{query.error.message}</p>
        <Button onClick={() => void query.refetch()}>Try again</Button>
      </section>
    );
  }
  return <TripSkeleton />;
}

function TripSkeleton() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div aria-busy="true" className="space-y-4">
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      ))}
      {slow && (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          Waking up the server…
        </p>
      )}
    </div>
  );
}

function formatRange(from: string, to: string) {
  const f = parseISO(from);
  const t = parseISO(to);
  if (from === to) return format(f, 'EEE d MMM yyyy');
  return f.getFullYear() === t.getFullYear()
    ? `${format(f, 'd MMM')} – ${format(t, 'd MMM yyyy')}`
    : `${format(f, 'd MMM yyyy')} – ${format(t, 'd MMM yyyy')}`;
}

function TripWorkspace({ token, data }: { token: string; data: TripResponse }) {
  const { trip, access } = data;
  const { role, permissions } = access;
  const tokenRole = role === 'public' ? 'viewer' : role;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const displayName = useDisplayName();
  const [searchParams, setSearchParams] = useSearchParams();

  // Captured once: the share dialog opens automatically right after creation (AC1.1).
  const [justCreated] = useState(() => searchParams.get('created') === '1');
  const [shareOpen, setShareOpen] = useState(justCreated);
  const [nameOpen, setNameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState<'delete' | 'approve' | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'plan' | 'ideas'>('plan');
  const afterName = useRef<(() => void) | null>(null);
  // Captured once: dropping ?created (below) replaces the history entry and its state.
  const location = useLocation();
  const [created] = useState(() => location.state as CreatedState | null);

  // Remember this trip on the device (F11) and drop the one-off ?created flag.
  useEffect(() => {
    rememberTrip({ name: trip.name, role: tokenRole, token });
  }, [trip.name, tokenRole, token]);
  useEffect(() => {
    if (searchParams.get('created')) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  // Warn before leaving with unsaved edits (frontend-spec §8).
  const unsaved = useHasUnsaved();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    return hasUnsaved() && currentLocation.pathname !== nextLocation.pathname;
  });
  useEffect(() => {
    if (!unsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [unsaved]);

  const requestName = useCallback((then: () => void) => {
    afterName.current = then;
    setNameOpen(true);
  }, []);

  const onCompleted = useCallback(() => {
    toast.show('This trip has ended and is read-only.', 'info');
    void queryClient.invalidateQueries({ queryKey: tripKey(token) });
  }, [queryClient, toast, token]);

  async function handleDelete() {
    try {
      await deleteTrip(token);
    } catch (err) {
      if (!isApiError(err) || err.status !== 404) {
        toast.show(isApiError(err) ? err.message : 'Couldn’t delete the trip.', 'error');
        return;
      }
    }
    for (const t of [token, trip.links?.editToken, trip.links?.viewToken]) if (t) forgetTrip(t);
    queryClient.removeQueries({ queryKey: tripKey(token) });
    toast.show('Trip deleted');
    navigate('/', { replace: true });
  }

  async function handleDismiss() {
    try {
      const { dismissedCount } = await dismissDeleteRequests(token);
      toast.show(`Dismissed ${dismissedCount} request${dismissedCount === 1 ? '' : 's'}`);
      await queryClient.invalidateQueries({ queryKey: tripKey(token) });
    } catch (err) {
      toast.show(isApiError(err) ? err.message : 'Couldn’t dismiss the requests.', 'error');
    }
  }

  async function handleRequestDeletion(name: string) {
    setDisplayName(name);
    try {
      await requestDeletion(token, name);
      setRequestOpen(false);
      toast.show('Request sent to organiser');
    } catch (err) {
      toast.show(isApiError(err) ? err.message : 'Couldn’t send the request.', 'error');
    }
  }

  async function handlePublish(publish: boolean) {
    try {
      const { status } = await setPublished(token, publish);
      queryClient.setQueryData<TripResponse>(tripKey(token), (prev) =>
        prev ? { ...prev, trip: { ...prev.trip, status } } : prev,
      );
      toast.show(publish ? 'Trip published' : 'Trip is private again');
    } catch (err) {
      toast.show(isApiError(err) ? err.message : 'Couldn’t change publishing.', 'error');
    }
  }

  // "Add to plan" (AC3.2): needs a display name first, then the DayCard appends and saves.
  function onAddPlace(day: Day, place: Place) {
    const add = () => {
      if (!appendToDay(day.id, placeLine(place.name, place.categoryLabel))) {
        toast.show('Couldn’t add the place — please try again.', 'error');
      }
    };
    if (displayName) add();
    else requestName(add);
  }

  const completed = trip.status.isCompleted;
  const panelTab = (tab: 'plan' | 'ideas') =>
    `flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${
      mobileTab === tab
        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
        : 'text-slate-600 dark:text-slate-300'
    }`;

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">
              {trip.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden />
                {trip.destination.name}, {trip.destination.country}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-4" aria-hidden />
                {formatRange(trip.fromDate, trip.toDate)} · {trip.dayCount} day
                {trip.dayCount === 1 ? '' : 's'}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {permissions.canEditTrip && (
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden />
                Edit details
              </Button>
            )}
            {permissions.canPublish &&
              (trip.status.isPublished ? (
                <Button variant="secondary" size="sm" onClick={() => void handlePublish(false)}>
                  <EyeOff className="size-4" aria-hidden />
                  Un-publish
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setPublishOpen(true)}>
                  <Globe className="size-4" aria-hidden />
                  Publish
                </Button>
              ))}
            {permissions.canViewShareLinks && trip.links && (
              <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)}>
                <Share2 className="size-4" aria-hidden />
                Share
              </Button>
            )}
            {permissions.canRequestDeletion && (
              <Button variant="ghost" size="sm" onClick={() => setRequestOpen(true)}>
                <Trash2 className="size-4" aria-hidden />
                Request deletion
              </Button>
            )}
            {permissions.canDelete && (
              <Button variant="ghost" size="sm" onClick={() => setDeleteOpen('delete')}>
                <Trash2 className="size-4" aria-hidden />
                Delete trip
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge kind={trip.status.isPublished ? 'published' : 'private'} />
          {completed && <StatusBadge kind="completed" />}
          {role === 'viewer' && <StatusBadge kind="view-only" />}
        </div>
      </header>

      <RoleTip role={tokenRole} hasRecoveryEmail={trip.hasRecoveryEmail ?? true} />

      {trip.pendingDeleteRequests && (
        <DeleteRequestsBanner
          requests={trip.pendingDeleteRequests}
          onApprove={() => setDeleteOpen('approve')}
          onDismiss={() => void handleDismiss()}
        />
      )}
      {completed && <Banner>This trip has ended and is now read-only.</Banner>}
      {role === 'viewer' && !completed && <Banner>You’re viewing this trip read-only.</Banner>}

      {/* Mobile: Plan / Ideas tabs. lg+: days and side panel side by side (frontend-spec §3.3). */}
      <div
        role="tablist"
        aria-label="Trip sections"
        className="flex gap-1 rounded-xl bg-slate-100 p-1 lg:hidden dark:bg-slate-900"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'plan'}
          onClick={() => setMobileTab('plan')}
          className={panelTab('plan')}
        >
          Plan
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'ideas'}
          onClick={() => setMobileTab('ideas')}
          className={panelTab('ideas')}
        >
          Ideas
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section
          aria-label="Day plans"
          className={`space-y-4 ${mobileTab === 'plan' ? '' : 'hidden lg:block'}`}
        >
          {trip.days.map((day) => (
            <DayCard
              key={day.id}
              token={token}
              day={day}
              canEdit={permissions.canEditDays}
              editorName={displayName}
              requestName={requestName}
              onCompleted={onCompleted}
            />
          ))}
        </section>
        <aside
          aria-label="Ideas"
          className={`lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto ${
            mobileTab === 'ideas' ? '' : 'hidden lg:block'
          }`}
        >
          <SidePanel
            destinationId={trip.destination.id}
            excludeSlug={trip.slug}
            days={permissions.canEditDays ? trip.days : undefined}
            onAddPlace={permissions.canEditDays ? onAddPlace : undefined}
          />
        </aside>
      </div>

      {trip.links && (
        <ShareLinksDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          links={trip.links}
          tripName={trip.name}
          justCreated={justCreated}
          note={
            justCreated && created?.emailedTo ? (
              <Banner>We’ve emailed the organiser link to {created.emailedTo}.</Banner>
            ) : justCreated && created?.emailFailed ? (
              <Banner variant="warning">
                We couldn’t send the email — please copy your organiser link now.
              </Banner>
            ) : null
          }
        />
      )}

      <DisplayNamePrompt
        open={nameOpen}
        onOpenChange={setNameOpen}
        onSubmit={(name) => {
          setDisplayName(name);
          setNameOpen(false);
          const then = afterName.current;
          afterName.current = null;
          setTimeout(() => then?.(), 0);
        }}
      />

      <DisplayNamePrompt
        open={requestOpen}
        onOpenChange={setRequestOpen}
        initial={displayName ?? ''}
        title="Ask the organiser to delete this trip?"
        description="Nothing is deleted now. The organiser will see your request and decide."
        submitLabel="Send request"
        onSubmit={(name) => void handleRequestDeletion(name)}
      />

      <ConfirmDialog
        open={deleteOpen !== null}
        onOpenChange={(o) => !o && setDeleteOpen(null)}
        title={deleteOpen === 'approve' ? 'Approve and delete this trip?' : 'Delete this trip?'}
        body="The trip and all its plans will be removed for everyone, and all links will stop working. This can’t be undone."
        confirmLabel="Delete trip"
        destructive
        onConfirm={handleDelete}
      />

      {permissions.canEditTrip && (
        <EditTripDialog open={editOpen} onOpenChange={setEditOpen} token={token} trip={trip} />
      )}

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publish this trip?"
        body="Anyone will be able to find it under Explore and read the plan. Its links stay private, and you can un-publish at any time."
        confirmLabel="Publish"
        onConfirm={() => handlePublish(true)}
      />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}
        title="Leave without saving?"
        body="Some changes haven’t been saved yet. If you leave now they may be lost."
        confirmLabel="Leave anyway"
        destructive
        onConfirm={() => {
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </div>
  );
}
