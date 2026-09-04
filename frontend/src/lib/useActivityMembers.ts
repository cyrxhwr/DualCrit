import { useEffect, useState } from 'react';
import { getSocket } from './socket';
import { useActivityRoom } from './useActivityRoom';

export interface LiveMember {
  studentUuid: string;
  fullName: string;
  isHost: boolean;
  currentStep: string | null;
  isOnline: boolean;
}

/**
 * The live member list for an activity.
 *
 * The server sends the whole list on every change rather than deltas, so a
 * dropped message cannot leave this out of step — the next event repairs it.
 */
export function useActivityMembers(activityId: string | undefined) {
  const [members, setMembers] = useState<LiveMember[]>([]);
  const connected = useActivityRoom(activityId);

  useEffect(() => {
    if (!activityId) return;
    const socket = getSocket();

    const onMembers = (payload: {
      activityId: string;
      members: LiveMember[];
    }) => {
      if (payload.activityId !== activityId) return;
      setMembers(payload.members);
    };

    socket.on('activity:members', onMembers);
    return () => {
      socket.off('activity:members', onMembers);
    };
  }, [activityId]);

  return { members, connected };
}
