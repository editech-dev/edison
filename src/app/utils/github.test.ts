// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- In-memory Redis stand-in ---
const store = new Map<string, unknown>();
const locks = new Set<string>();
vi.mock('@/app/utils/redis', () => ({
  getCachedData: vi.fn(async (key: string) => (store.has(key) ? structuredClone(store.get(key)) : null)),
  cacheData: vi.fn(async (key: string, data: unknown) => {
    store.set(key, structuredClone(data));
  }),
  acquireLock: vi.fn(async (key: string) => {
    if (locks.has(key)) return false;
    locks.add(key);
    return true;
  }),
  releaseLock: vi.fn(async (key: string) => {
    locks.delete(key);
  }),
}));

// --- Gemini stand-in ---
const translation = { failing: false };
vi.mock('./translation', () => ({
  detectLanguage: vi.fn(async () => {
    if (translation.failing) throw Object.assign(new Error('UNAVAILABLE'), { status: 503 });
    return 'en';
  }),
  translateText: vi.fn(async (text: string, lang: string) => {
    if (translation.failing) throw Object.assign(new Error('UNAVAILABLE'), { status: 503 });
    return `[${lang}] ${text}`;
  }),
}));

// --- after(): collect the callbacks instead of running them ---
const scheduled: Array<() => unknown> = [];
vi.mock('next/server', () => ({
  after: vi.fn((callback: () => unknown) => {
    scheduled.push(callback);
  }),
}));

const README = 'A'.repeat(150);
const SNAPSHOT_KEY = 'github:repos:public:snapshot';

const repo = (name: string, extra: Record<string, unknown> = {}) => ({
  id: name.length,
  name,
  html_url: `https://github.com/owner/${name}`,
  description: `${name} description`,
  language: 'TypeScript',
  stargazers_count: 0,
  updated_at: '2026-11-01T00:00:00Z',
  ...extra,
});

const bilingual = (name: string, readme = README) => ({
  ...repo(name),
  originalLanguage: 'en' as const,
  en: { description: `${name} description`, readme },
  es: { description: `[es] ${name} description`, readme: `[es] ${readme}` },
});

type FetchMode = { list: unknown[]; readmes: Record<string, string>; hang?: boolean; status?: number };
let fetchMode: FetchMode;

// fetch that honours AbortSignal, like the real one.
const fakeFetch = vi.fn((url: string, init?: RequestInit) => {
  if (fetchMode.hang) {
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    });
  }
  if (fetchMode.status) return Promise.resolve(new Response('', { status: fetchMode.status }));
  if (url.includes('/users/')) return Promise.resolve(Response.json(fetchMode.list));
  const readmeMatch = url.match(/\/repos\/[^/]+\/([^/]+)\/readme$/);
  if (readmeMatch) {
    const body = fetchMode.readmes[decodeURIComponent(readmeMatch[1])];
    return Promise.resolve(body ? new Response(body) : new Response('', { status: 404 }));
  }
  return Promise.resolve(new Response('', { status: 404 }));
});

const load = async () => {
  vi.resetModules();
  return import('./github');
};

describe('github repositories: read path never waits on GitHub or Gemini', () => {
  beforeEach(() => {
    store.clear();
    locks.clear();
    scheduled.length = 0;
    translation.failing = false;
    fetchMode = { list: [], readmes: {} };
    process.env.GITHUB_REPO_OWNER = 'owner';
    vi.stubGlobal('fetch', fakeFetch);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serves the static fallback when the cache is empty, without calling GitHub or Gemini', async () => {
    const { getPublicRepositories } = await load();
    const translationModule = await import('./translation');

    const repos = await getPublicRepositories();

    expect(repos.length).toBeGreaterThan(0);
    expect(repos.every((r) => r.es && r.en)).toBe(true);
    expect(fakeFetch).not.toHaveBeenCalled();
    expect(translationModule.translateText).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1); // a background refresh is scheduled
  });

  it('serves a fresh snapshot without scheduling a refresh', async () => {
    store.set(SNAPSHOT_KEY, { generatedAt: Date.now(), complete: true, repos: [bilingual('alpha')] });
    const { getPublicRepositories } = await load();

    expect((await getPublicRepositories()).map((r) => r.name)).toEqual(['alpha']);
    expect(scheduled).toHaveLength(0);
  });

  it('serves a stale snapshot immediately and refreshes in the background', async () => {
    store.set(SNAPSHOT_KEY, { generatedAt: Date.now() - 2 * 60 * 60 * 1000, complete: true, repos: [bilingual('alpha')] });
    const { getPublicRepositories } = await load();

    expect((await getPublicRepositories()).map((r) => r.name)).toEqual(['alpha']);
    expect(fakeFetch).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
  });

  it('answers in under 3 s for an unknown repository when GitHub hangs (error, not 404)', async () => {
    fetchMode.hang = true;
    const { getRepositoryByName } = await load();

    const started = Date.now();
    await expect(getRepositoryByName('not-cached-anywhere')).rejects.toBeTruthy();
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('returns null only when GitHub confirms the repository does not exist', async () => {
    fetchMode.status = 404;
    const { getRepositoryByName } = await load();

    expect(await getRepositoryByName('does-not-exist')).toBeNull();
  });

  it('answers impossible repository names as not found without calling GitHub', async () => {
    const { getRepositoryByName } = await load();

    for (const name of ['..', '.', '../../users', 'a/b', 'name?x=1', 'x'.repeat(101), '']) {
      expect(await getRepositoryByName(name)).toBeNull();
    }
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('does not schedule refreshes for a repository that is only on GitHub', async () => {
    fetchMode.status = undefined;
    fakeFetch.mockImplementationOnce(() => Promise.resolve(Response.json(repo('unlisted'))));
    const { getRepositoryByName } = await load();

    expect((await getRepositoryByName('unlisted'))?.name).toBe('unlisted');
    expect(scheduled).toHaveLength(0);
  });

  it('resolves a known repository from the snapshot without calling GitHub', async () => {
    store.set(SNAPSHOT_KEY, { generatedAt: Date.now(), complete: true, repos: [bilingual('alpha')] });
    const { getRepositoryByName } = await load();

    expect((await getRepositoryByName('alpha'))?.name).toBe('alpha');
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});

describe('github repositories: background refresh', () => {
  beforeEach(() => {
    store.clear();
    locks.clear();
    scheduled.length = 0;
    translation.failing = false;
    process.env.GITHUB_REPO_OWNER = 'owner';
    fetchMode = {
      list: [repo('alpha', { stargazers_count: 3 }), repo('beta'), repo('tiny')],
      readmes: { alpha: README, beta: README, tiny: 'too short' },
    };
    vi.stubGlobal('fetch', fakeFetch);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a complete snapshot, translating new content and skipping short READMEs', async () => {
    const { refreshPublicRepositories } = await load();

    const snapshot = await refreshPublicRepositories();

    expect(snapshot?.complete).toBe(true);
    expect(snapshot?.repos.map((r) => r.name)).toEqual(['alpha', 'beta']);
    expect(snapshot?.repos[0].es.readme).toBe(`[es] ${README}`);
    expect(snapshot?.repos[0].stargazers_count).toBe(3);
    expect(store.get(SNAPSHOT_KEY)).toEqual(snapshot);
  });

  it('keeps the previous translation when Gemini returns 503, and marks the snapshot incomplete', async () => {
    const previous = { ...bilingual('alpha', 'old readme '.repeat(20)), stargazers_count: 1 };
    store.set(SNAPSHOT_KEY, { generatedAt: 0, complete: true, repos: [previous] });
    translation.failing = true;
    const { refreshPublicRepositories } = await load();

    const snapshot = await refreshPublicRepositories();

    expect(snapshot?.complete).toBe(false);
    const alpha = snapshot!.repos.find((r) => r.name === 'alpha')!;
    expect(alpha.es).toEqual(previous.es); // previous translation kept
    expect(alpha.stargazers_count).toBe(3); // metadata updated
    // Nothing half-translated was stored per repository.
    expect(store.has('github:repo:bilingual:alpha')).toBe(false);
  });

  it('keeps the previous snapshot untouched when GitHub fails', async () => {
    const previous = { generatedAt: 0, complete: true, repos: [bilingual('alpha')] };
    store.set(SNAPSHOT_KEY, previous);
    fetchMode.status = 500;
    const { refreshPublicRepositories } = await load();

    expect(await refreshPublicRepositories()).toBeNull();
    expect(store.get(SNAPSHOT_KEY)).toEqual(previous);
  });

  it('does not retry GitHub on every request during an outage (lock acts as cooldown)', async () => {
    fetchMode.status = 500;
    const { refreshPublicRepositories } = await load();

    await refreshPublicRepositories();
    const callsAfterFirst = fakeFetch.mock.calls.length;
    expect(await refreshPublicRepositories()).toBeNull();
    expect(fakeFetch.mock.calls.length).toBe(callsAfterFirst);
  });

  it('runs only one refresh at a time', async () => {
    const { refreshPublicRepositories } = await load();

    const [first, second] = await Promise.all([refreshPublicRepositories(), refreshPublicRepositories()]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    const listCalls = fakeFetch.mock.calls.filter(([url]) => String(url).includes('/users/'));
    expect(listCalls).toHaveLength(1);
  });
});
