import { ActivityLock } from './activity-lock';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('ActivityLock', () => {
  it('runs work for the same activity one at a time, in arrival order', async () => {
    const lock = new ActivityLock();
    const events: string[] = [];

    const job = (name: string, ms: number) =>
      lock.run('a1', async () => {
        events.push(`${name} start`);
        await tick(ms);
        events.push(`${name} end`);
      });

    await Promise.all([job('first', 20), job('second', 1), job('third', 1)]);

    expect(events).toEqual([
      'first start',
      'first end',
      'second start',
      'second end',
      'third start',
      'third end',
    ]);
  });

  it('lets different activities run at the same time', async () => {
    const lock = new ActivityLock();
    const events: string[] = [];

    await Promise.all([
      lock.run('a1', async () => {
        events.push('a1 start');
        await tick(20);
        events.push('a1 end');
      }),
      lock.run('a2', async () => {
        events.push('a2 start');
        await tick(1);
        events.push('a2 end');
      }),
    ]);

    expect(events.indexOf('a2 end')).toBeLessThan(events.indexOf('a1 end'));
  });

  it('keeps going after a failed request', async () => {
    const lock = new ActivityLock();

    await expect(
      lock.run('a1', () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
    await expect(lock.run('a1', () => Promise.resolve('ok'))).resolves.toBe(
      'ok',
    );
  });
});
