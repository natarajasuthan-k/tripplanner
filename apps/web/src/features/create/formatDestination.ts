import type { Destination } from '@tripplanner/shared';

/** "Kyoto, Kyoto Prefecture, Japan" — region omitted when it repeats the city. */
export const formatDestination = (d: Destination) =>
  [d.name, d.region && d.region !== d.name ? d.region : null, d.country].filter(Boolean).join(', ');
