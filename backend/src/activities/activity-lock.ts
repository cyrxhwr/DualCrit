import { Injectable } from '@nestjs/common';

/**
 * Runs work for the same activity one request at a time.
 *
 * Joining, submitting and voting all read the current state, decide, then
 * write. Two requests for one activity arriving together could each read
 * before the other wrote — which is how a four-seat team took six members, a
 * student ended up holding two votes, and two POV statements were both marked
 * as the team's choice. Queuing per activity closes that window.
 *
 * The queue lives in this process, so it holds while the backend runs as a
 * single instance — which the realtime rooms already require. The callers
 * keep database-level guards that stay correct if that ever changes.
 */
@Injectable()
export class ActivityLock {
  private readonly tails = new Map<string, Promise<unknown>>();

  async run<T>(activityId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(activityId) ?? Promise.resolve();
    // A failed request must not jam the queue for everyone after it.
    const current = previous.catch(() => undefined).then(work);
    const tail = current.catch(() => undefined);
    this.tails.set(activityId, tail);

    try {
      return await current;
    } finally {
      // Only the most recent request clears the entry, so the map does not
      // grow with every activity ever touched.
      if (this.tails.get(activityId) === tail) this.tails.delete(activityId);
    }
  }
}
