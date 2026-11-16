// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Handler = (err: Error) => void;

interface FakeClient {
  isReady: boolean;
  handlers: Record<string, Handler>;
  store: Map<string, string>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  on: (event: string, handler: Handler) => FakeClient;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<'OK'>;
}

// Each createClient() call takes the next behaviour from this queue.
const connectBehaviours: Array<'ok' | 'fail' | 'hang'> = [];
const createdClients: FakeClient[] = [];

vi.mock('redis', () => ({
  createClient: vi.fn(() => {
    const behaviour = connectBehaviours.shift() ?? 'ok';
    const client: FakeClient = {
      isReady: false,
      handlers: {},
      store: new Map(),
      connect: vi.fn(() => {
        if (behaviour === 'fail') return Promise.reject(new Error('ECONNREFUSED'));
        if (behaviour === 'hang') return new Promise(() => {});
        client.isReady = true;
        return Promise.resolve(client);
      }),
      disconnect: vi.fn(() => Promise.resolve()),
      on(event, handler) {
        client.handlers[event] = handler;
        return client;
      },
      get: async (key) => client.store.get(key) ?? null,
      set: async (key, value) => {
        client.store.set(key, value);
        return 'OK';
      },
    };
    createdClients.push(client);
    return client;
  }),
}));

const loadModule = async () => {
  vi.resetModules();
  const redis = await import('redis');
  const mod = await import('./redis');
  return { mod, createClient: vi.mocked(redis.createClient) };
};

describe('redis client resilience', () => {
  const originalUrl = process.env.REDIS_URL;

  beforeEach(() => {
    connectBehaviours.length = 0;
    createdClients.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalUrl;
  });

  it('uses the in-memory store without trying to connect when REDIS_URL is empty', async () => {
    delete process.env.REDIS_URL;
    const { mod, createClient } = await loadModule();

    await mod.cacheData('k', { a: 1 }, 60);
    expect(await mod.getCachedData('k')).toEqual({ a: 1 });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('falls back to memory on a failed connection and retries after the cooldown', async () => {
    process.env.REDIS_URL = 'redis://example.invalid:6379';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    connectBehaviours.push('fail', 'ok');
    const { mod, createClient } = await loadModule();

    await mod.cacheData('k', 'memory', 60);
    expect(await mod.getCachedData('k')).toBe('memory');
    expect(createClient).toHaveBeenCalledTimes(1);

    // Still inside the cooldown: no new connection attempt.
    vi.setSystemTime(new Date('2026-11-16T10:00:10Z'));
    await mod.getCachedData('k');
    expect(createClient).toHaveBeenCalledTimes(1);

    // Cooldown elapsed: reconnects and uses Redis again.
    vi.setSystemTime(new Date('2026-11-16T10:01:00Z'));
    await mod.cacheData('k', 'redis', 60);
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(createdClients[1].store.get('k')).toBe(JSON.stringify('redis'));
    expect(await mod.getCachedData('k')).toBe('redis');
  });

  it('does not wait more than the connect timeout when Redis hangs', async () => {
    process.env.REDIS_URL = 'redis://example.invalid:6379';
    connectBehaviours.push('hang');
    const { mod } = await loadModule();

    const started = Date.now();
    expect(await mod.getCachedData('missing')).toBeNull();
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('recovers after a runtime error on an established connection', async () => {
    process.env.REDIS_URL = 'redis://example.invalid:6379';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    connectBehaviours.push('ok', 'ok');
    const { mod, createClient } = await loadModule();

    await mod.cacheData('k', 'first', 60);
    expect(createdClients[0].store.get('k')).toBe(JSON.stringify('first'));

    // The live connection drops.
    createdClients[0].isReady = false;
    createdClients[0].handlers.error(new Error('socket closed'));
    await mod.cacheData('k', 'during-outage', 60);
    expect(createClient).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-11-16T10:01:00Z'));
    await mod.cacheData('k', 'after', 60);
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(createdClients[1].store.get('k')).toBe(JSON.stringify('after'));
  });
});
