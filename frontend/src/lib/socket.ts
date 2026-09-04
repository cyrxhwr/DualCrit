import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './api';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

/**
 * One shared connection for the app.
 *
 * The token goes on the handshake, so the server knows who is connected
 * without the client ever asserting an identity in a message.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE, {
      transports: ['websocket'],
      autoConnect: false,
      auth: { token: tokenStore.get() },
    });
  }
  return socket;
}

/** Called on sign out, so the next student does not inherit the connection. */
export function resetSocket(): void {
  socket?.disconnect();
  socket = null;
}
