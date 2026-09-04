import { useEffect, useState } from 'react';
import { getSocket } from './socket';

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
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!activityId) return;

    const socket = getSocket();

    const join = () => {
      setConnected(true);
      socket.emit('activity:join', { activityId });
    };

    const onMembers = (payload: {
      activityId: string;
      members: LiveMember[];
    }) => {
      if (payload.activityId !== activityId) return;
      setMembers(payload.members);
    };

    const onDisconnect = () => setConnected(false);

    socket.on('connect', join);
    socket.on('activity:members', onMembers);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) join();
    else socket.connect();

    return () => {
      socket.off('connect', join);
      socket.off('activity:members', onMembers);
      socket.off('disconnect', onDisconnect);
    };
  }, [activityId]);

  return { members, connected };
}
