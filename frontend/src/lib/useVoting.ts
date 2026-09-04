import { useCallback, useEffect, useState } from 'react';
import { api, type VotingState } from './api';
import { getSocket } from './socket';

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

  useEffect(() => {
    if (!activityId) return;
    let cancelled = false;

    api
      .votingState(activityId, type)
      .then((result) => {
        if (cancelled) return;
        setState(result.state);
        setMyVote(result.myVote);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load voting'),
      )
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [activityId, type]);

  // Everyone in the room gets the new tally the moment a vote lands.
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
