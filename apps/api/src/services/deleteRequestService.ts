// Delete requests — backend-spec BR14, api-contract E13/E14.
import type { DeleteRequestView } from '@tripplanner/shared';
import type { Db } from '../db/client';
import {
  dismissPendingDeleteRequests,
  insertDeleteRequest,
} from '../repositories/deleteRequestRepo';
import type { TripRow } from '../repositories/tripRepo';
import { toDeleteRequest } from './views';

export async function requestDeletion(
  db: Db,
  trip: TripRow,
  requestedByName: string,
): Promise<DeleteRequestView> {
  return toDeleteRequest(await insertDeleteRequest(db, trip.id, requestedByName));
}

export function dismissAll(db: Db, trip: TripRow): Promise<number> {
  return dismissPendingDeleteRequests(db, trip.id);
}
