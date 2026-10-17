// "I'm editing" heartbeat — frontend-spec §3.4 step 1, api-contract E11/E12. Errors are ignored.
import { PRESENCE_HEARTBEAT_SECONDS } from '@tripplanner/shared';
import { useEffect } from 'react';
import { clearPresence, sendPresence } from './api';

export function usePresence(
  token: string,
  dayId: string,
  editorName: string | null,
  active: boolean,
) {
  useEffect(() => {
    if (!active || !editorName) return;
    const beat = () => void sendPresence(token, dayId, editorName).catch(() => {});
    beat();
    const timer = setInterval(beat, PRESENCE_HEARTBEAT_SECONDS * 1000);
    return () => {
      clearInterval(timer);
      void clearPresence(token, dayId).catch(() => {});
    };
  }, [token, dayId, editorName, active]);
}
