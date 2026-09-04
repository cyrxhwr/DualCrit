import { useEffect, useState } from 'react';
import { getSocket } from './socket';

/**
 * Ensures this client is connected and watching an activity's room.
 *
 * Anything that depends on room broadcasts calls this itself rather than
 * assuming some other hook already joined. Relying on one hook's side effect
 * to make a second hook work is exactly the kind of ordering dependency that
 * fails intermittently and is miserable to debug.
 *
 * Joining is idempotent on the server, so calling it from several places, or
 * again after a reconnect, costs nothing.
 */
export function useActivityRoom(activityId: string | undefined): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!activityId) return;

    const socket = getSocket();

    const join = () => {
      setConnected(true);
      socket.emit('activity:join', { activityId });
    };
    const onDisconnect = () => setConnected(false);

    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) join();
    else socket.connect();

    return () => {
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
    };
  }, [activityId]);

  return connected;
}
