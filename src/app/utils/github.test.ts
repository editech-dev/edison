// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- In-memory Redis stand-in ---
const store = new Map<string, unknown>();
const ttls = new Map<string, number | undefined>();
const locks = new Set<string>();
vi.mock('@/app/utils/redis', () => ({
  getCachedData: vi.fn(async (key: string) => (store.has(key) ? structuredClone(store.get(key)) : null)),
  cacheData: vi.fn(async (key: string, data: unknown, ttlSeconds?: number) => {
    store.set(key, structuredClone(data));
    ttls.set(key, ttlSeconds);
  }),
  deleteCachedData: vi.fn(async (key: string) => {
    store.delete(key);
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
const translation = { failing: false, quota: false };
vi.mock('./translation', () => ({
  detectLanguage: vi.fn(async () => {
    if (translation.quota) throw Object.assign(new Error('RESOURCE_EXHAUSTED: quota exceeded'), { status: 429 });
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

    const repos = await getPublicRepositories(true);

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

    expect((await getPublicRepositories(true)).map((r) => r.name)).toEqual(['alpha']);
    expect(fakeFetch).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);
  });

  it('never schedules a refresh from callers without the long function limit (sitemap, chat tools)', async () => {
    store.set(SNAPSHOT_KEY, { generatedAt: 0, complete: true, repos: [bilingual('alpha')] });
    const { getPublicRepositories } = await load();

    await getPublicRepositories();
    expect(scheduled).toHaveLength(0);
  });

  it('treats the snapshot as the published list: unknown names are 404 without calling GitHub', async () => {
    store.set(SNAPSHOT_KEY, { generatedAt: Date.now(), complete: true, repos: [bilingual('alpha')] });
    // A stale per-repo translation of a repository that was removed must not be served.
    store.set('github:repo:bilingual:gone', bilingual('gone'));
    const { getRepositoryByName } = await load();

    expect(await getRepositoryByName('gone')).toBeNull();
    expect(await getRepositoryByName('some-random-name')).toBeNull();
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it('matches repository names case-insensitively', async () => {
    store.set(SNAPSHOT_KEY, { generatedAt: Date.now(), complete: true, repos: [bilingual('Edison-Dev')] });
    const { getRepositoryByName } = await load();

    expect((await getRepositoryByName('edison-dev'))?.name).toBe('Edison-Dev');
  });

  it('never publishes a private repository, even if the token can read it', async () => {
    fakeFetch.mockImplementationOnce(() => Promise.resolve(Response.json(repo('secret', { private: true, visibility: 'private' }))));
    const { getRepositoryByName } = await load();

    expect(await getRepositoryByName('secret')).toBeNull();
    // Its README is never requested.
    expect(fakeFetch).toHaveBeenCalledTimes(1);
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
    vi.useRealTimers();
    ttls.clear();
    store.clear();
    locks.clear();
    scheduled.length = 0;
    translation.failing = false;
    translation.quota = false;
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

  // --- R16: bounded token spending ---
  const translationCalls = async () => {
    const t = await import('./translation');
    return vi.mocked(t.translateText).mock.calls.length + vi.mocked(t.detectLanguage).mock.calls.length;
  };

  it('spends no tokens when the original text did not change, and stores translations without expiry', async () => {
    const { refreshPublicRepositories } = await load();
    await refreshPublicRepositories();
    const afterFirst = await translationCalls();
    expect(afterFirst).toBeGreaterThan(0);
    expect(ttls.get('github:repo:bilingual:alpha')).toBeUndefined();
    expect(ttls.get('github:repos:public:snapshot')).toBeUndefined();

    await refreshPublicRepositories();
    expect(await translationCalls()).toBe(afterFirst);
  });

  it('backs off after a failed translation instead of retrying in a loop', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    translation.failing = true;
    const { refreshPublicRepositories } = await load();

    const first = await refreshPublicRepositories();
    expect(first?.complete).toBe(false);
    expect(first?.retryAt).toBe(new Date('2026-11-16T10:05:00Z').getTime());
    expect(store.get('github:translation-failure:alpha')).toMatchObject({ attempts: 1 });
    const calls = await translationCalls();

    // One minute later: still waiting, Gemini is not called again.
    vi.setSystemTime(new Date('2026-11-16T10:01:00Z'));
    await refreshPublicRepositories();
    expect(await translationCalls()).toBe(calls);

    // After the wait: one more attempt, then the next wait is 1 hour.
    vi.setSystemTime(new Date('2026-11-16T10:06:00Z'));
    await refreshPublicRepositories();
    expect(await translationCalls()).toBeGreaterThan(calls);
    expect(store.get('github:translation-failure:alpha')).toMatchObject({ attempts: 2 });
  });

  it('gives up after the maximum attempts for the same text, until the text changes', async () => {
    translation.failing = true;
    const { refreshPublicRepositories, textHash } = await load();
    for (const name of ['alpha', 'beta']) {
      store.set(`github:translation-failure:${name}`, {
        hash: textHash(`${name} description`, README),
        attempts: 4,
        nextRetryAt: Number.MAX_SAFE_INTEGER,
      });
    }

    const snapshot = await refreshPublicRepositories();
    expect(await translationCalls()).toBe(0);
    expect(snapshot?.complete).toBe(true); // nothing pending: no more refresh loops for it
    expect(snapshot?.retryAt).toBeUndefined();

    // The README changes: it is a new version, so it is tried again.
    translation.failing = false;
    fetchMode.readmes.alpha = README + ' updated';
    await refreshPublicRepositories();
    expect(await translationCalls()).toBeGreaterThan(0);
    expect(store.has('github:translation-failure:alpha')).toBe(false);
  });

  it('translates at most a fixed number of repositories per refresh', async () => {
    const names = Array.from({ length: 8 }, (_, i) => `repo${i}`);
    fetchMode = { list: names.map((n) => repo(n)), readmes: Object.fromEntries(names.map((n) => [n, README])) };
    const { refreshPublicRepositories } = await load();

    const snapshot = await refreshPublicRepositories();
    const translated = names.filter((n) => store.has(`github:repo:bilingual:${n}`));
    expect(translated).toHaveLength(5);
    expect(snapshot?.complete).toBe(false);
    expect(snapshot?.retryAt).toBeDefined();
  });

  it('never treats an untranslated placeholder as a translation', async () => {
    const { getPublicRepositories } = await load();
    const untranslatedPlaceholder = { ...bilingual('alpha'), translated: false, es: { description: 'same', readme: README }, en: { description: 'same', readme: README } };
    store.set('github:repos:public:snapshot', { generatedAt: Date.now(), complete: false, retryAt: Date.now() + 300000, repos: [untranslatedPlaceholder] });

    const [alpha] = await getPublicRepositories();
    expect(alpha.translated).toBe(false);
  });

  it('does not count quota errors as attempts and stops translating for an hour', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'));
    translation.quota = true;
    const { refreshPublicRepositories } = await load();

    const snapshot = await refreshPublicRepositories();
    expect(await translationCalls()).toBe(1); // first 429 stops the run
    expect(store.has('github:translation-failure:alpha')).toBe(false);
    expect(snapshot?.retryAt).toBe(new Date('2026-11-16T11:00:00Z').getTime());
  });
});
