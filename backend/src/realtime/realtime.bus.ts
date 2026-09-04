import { Global, Injectable, Module } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface Broadcast {
  activityId: string;
  event: string;
  payload: unknown;
}

/**
 * How the rest of the app asks for something to be sent to an activity's room.
 *
 * Controllers publish here rather than injecting the gateway directly. That
 * keeps them ignorant of the transport, and it breaks the dependency cycle
 * that otherwise appears as soon as the gateway needs a service whose module
 * also wants to broadcast.
 */
@Injectable()
export class RealtimeBus {
  private readonly emitter = new EventEmitter();

  publish(activityId: string, event: string, payload: unknown): void {
    this.emitter.emit('broadcast', { activityId, event, payload });
  }

  subscribe(handler: (message: Broadcast) => void): void {
    this.emitter.on('broadcast', handler);
  }
}

@Global()
@Module({
  providers: [RealtimeBus],
  exports: [RealtimeBus],
})
export class RealtimeBusModule {}
