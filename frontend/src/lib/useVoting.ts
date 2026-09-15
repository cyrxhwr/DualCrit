import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [busy, setBusy] = useState(false);
  // A ref, not just state: two clicks in the same frame both read `busy` as
  // false before React re-renders, and both requests go out.
  const inFlight = useRef(false);

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
      if (!activityId || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        // The server decides how many options a vote picks; the count is still
        // sent so this page also works against a backend from before that.
        setState(await api.startVoting(activityId, type, maxSelections));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start voting');
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [activityId, type],
  );

  const castVote = useCallback(
    async (optionIds: string[]) => {
      if (!activityId || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        setState(await api.castVote(activityId, type, optionIds));
        setMyVote(optionIds);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save vote');
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [activityId, type],
  );

  return { state, myVote, loading, error, busy, start, castVote };
}
