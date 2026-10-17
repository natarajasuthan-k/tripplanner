import type { TripLinks } from '@tripplanner/shared';

export interface ShareLink {
  kind: 'organiser' | 'edit' | 'view';
  label: string;
  hint: string;
  url: string;
}

/** Full share URLs built from the current origin (frontend-spec §10). */
export function buildShareLinks(links: TripLinks, origin = window.location.origin): ShareLink[] {
  const out: ShareLink[] = [];
  out.push({
    kind: 'edit',
    label: 'Edit link',
    hint: 'For fellow travellers — they can edit the plan.',
    url: `${origin}/e/${links.editToken}`,
  });
  out.push({
    kind: 'view',
    label: 'View-only link',
    hint: 'For family and friends — read-only.',
    url: `${origin}/v/${links.viewToken}`,
  });
  if (links.organiserToken) {
    out.push({
      kind: 'organiser',
      label: 'Organiser link',
      hint: 'Keep this private — it controls the trip.',
      url: `${origin}/o/${links.organiserToken}`,
    });
  }
  return out;
}
