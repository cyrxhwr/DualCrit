import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ActivitiesService } from '../activities/activities.service';
import { RealtimeBus } from './realtime.bus';

interface TokenPayload {
  sub: string;
  studentId: string;
  fullName: string;
}

interface SocketState {
  studentUuid: string;
  activityId?: string;
}

/**
 * Live updates for an activity.
 *
 * Two rules this gateway exists to keep:
 *
 * 1. The socket is a notification channel, never a store. Every payload it
 *    sends is read from the database at send time, so a restart or a second
 *    backend instance changes nothing about what clients see.
 *
 * 2. Identity comes from the verified token on the handshake, never from the
 *    message body. A client cannot claim to be someone else by saying so.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() private server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  /** Socket id -> who they are and which activity they are watching. */
  private readonly sockets = new Map<string, SocketState>();

  constructor(
    private readonly jwt: JwtService,
    private readonly activities: ActivitiesService,
    private readonly bus: RealtimeBus,
  ) {
    // Anything published on the bus goes to that activity room.
    this.bus.subscribe(({ activityId, event, payload }) =>
      this.emitToActivity(activityId, event, payload),
    );
  }

  async handleConnection(socket: Socket): Promise<void> {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      socket.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<TokenPayload>(token);
      this.sockets.set(socket.id, { studentUuid: payload.sub });
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const state = this.sockets.get(socket.id);
    this.sockets.delete(socket.id);

    // Leaving does not remove anyone from the team — it only changes who is
    // currently online, so the rest of the room gets a fresh list.
    if (state?.activityId) {
      void this.broadcastMembers(state.activityId);
    }
  }

  @SubscribeMessage('activity:join')
  async handleJoin(
    @MessageBody() body: { activityId?: string },
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const state = this.sockets.get(socket.id);
    const activityId = body?.activityId;

    if (!state || !activityId) return;

    try {
      // Watching a room requires being in it. Knowing the id is not enough.
      await this.activities.assertMember(activityId, state.studentUuid);
    } catch {
      socket.emit('activity:error', {
        message: 'You are not in this activity',
      });
      return;
    }

    await socket.join(activityId);
    this.sockets.set(socket.id, { ...state, activityId });

    await this.broadcastMembers(activityId);
    this.logger.log(`${state.studentUuid} is watching activity ${activityId}`);
  }

  /**
   * Send the current member list to everyone watching.
   *
   * Safe to call as often as you like: it is derived state, so calling it
   * twice produces the same result rather than corrupting anything.
   */
  async broadcastMembers(activityId: string): Promise<void> {
    try {
      const members = await this.activities.listMembers(activityId);
      const online = this.onlineIn(activityId);

      this.server.to(activityId).emit('activity:members', {
        activityId,
        members: members.map((m) => ({
          ...m,
          isOnline: online.has(m.studentUuid),
        })),
      });
    } catch (error) {
      this.logger.error(
        `Could not broadcast members for ${activityId}`,
        error as Error,
      );
    }
  }

  /**
   * Tell everyone watching an activity that something changed.
   *
   * Callers pass state they have just read from the database, so this stays a
   * notification channel rather than a second copy of the truth.
   */
  emitToActivity(activityId: string, event: string, payload: unknown): void {
    // Logged because "the other window didn't update" is almost always a
    // client that is not in the room, and the room size says so immediately.
    this.logger.debug(
      `${event} -> activity ${activityId} (${this.roomSize(activityId)} watching)`,
    );
    this.server.to(activityId).emit(event, payload);
  }

  private roomSize(activityId: string): number {
    return this.server.sockets.adapter.rooms.get(activityId)?.size ?? 0;
  }

  private onlineIn(activityId: string): Set<string> {
    const online = new Set<string>();
    for (const state of this.sockets.values()) {
      if (state.activityId === activityId) online.add(state.studentUuid);
    }
    return online;
  }
}
