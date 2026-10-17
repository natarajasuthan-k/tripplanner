import { PagePlaceholder } from '../components/PagePlaceholder';

/** Which link opened the trip. The server-reported role is authoritative (frontend-spec §6). */
export type TripRouteMode = 'organiser' | 'editor' | 'viewer';

const TITLES: Record<TripRouteMode, string> = {
  organiser: 'Trip — organiser',
  editor: 'Trip — editor',
  viewer: 'Trip — view only',
};

export default function TripPage({ mode }: { mode: TripRouteMode }) {
  return <PagePlaceholder title={TITLES[mode]} spec="frontend-spec §3.3–3.4 (F2–F9)" />;
}
