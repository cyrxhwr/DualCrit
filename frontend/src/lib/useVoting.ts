import { useCallback, useEffect, useState } from 'react';
import { api, type VotingState } from './api';
import { getSocket } from './socket';
import { useActivityRoom } from './useActivityRoom';

/**
 * A voting round, kept live.
 *
 * `start` is safe to call from an effect: the server returns the running
 * round rather than resetting it, so several members arriving at once cannot
 * wipe each other's votes — the failure that made scenario voting unreliable
 * in the previous system.
 */
export function useVoting(activityId: string | undefined, type: string) {
  const [state, setState] = useState<VotingState | null>(null);
  const [myVote, setMyVote] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Join the room ourselves rather than assuming another hook did it.
  const connected = useActivityRoom(activityId);

  const refresh = useCallback(async () => {
    if (!activityId) return;
    try {
      const result = await api.votingState(activityId, type);
      setState(result.state);
      setMyVote(result.myVote);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load voting');
    } finally {
      setLoading(false);
    }
  }, [activityId, type]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Re-read on every (re)connect. A broadcast missed while the socket was
  // down would otherwise leave this screen showing a stale tally until the
  // student reloaded.
  useEffect(() => {
    if (connected) void refresh();
  }, [connected, refresh]);

  useEffect(() => {
    if (!activityId) return;
    const socket = getSocket();

    const onState = (incoming: VotingState) => {
      if (incoming.activityId !== activityId || incoming.type !== type) return;
      setState(incoming);
    };

    socket.on('voting:state', onState);
    return () => {
      socket.off('voting:state', onState);
    };
  }, [activityId, type]);

  const start = useCallback(
    async (maxSelections = 1) => {
      if (!activityId) return;
      try {
        setState(await api.startVoting(activityId, type, maxSelections));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start voting');
      }
    },
    [activityId, type],
  );

  const castVote = useCallback(
    async (optionIds: string[]) => {
      if (!activityId) return;
      setError(null);
      try {
        setState(await api.castVote(activityId, type, optionIds));
        setMyVote(optionIds);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save vote');
      }
    },
    [activityId, type],
  );

  return { state, myVote, loading, error, start, castVote };
}
