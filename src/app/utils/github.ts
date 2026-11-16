// src/app/utils/github.ts
//
// Two separate paths:
// - READ (request path): getPublicRepositories / getRepositoryByName. They answer from the Redis
//   snapshot (even when stale) or from the static bilingual fallback. They never call Gemini, and
//   only call GitHub (with a short timeout) for a single repository that is not known anywhere.
// - REFRESH (background, via `after()`): refreshPublicRepositories fetches GitHub, translates what
//   changed with Gemini and stores a new snapshot. A failed translation is never stored: the
//   previous version is kept and the snapshot is marked incomplete so it is retried later.
import { cache } from 'react';
import { after } from 'next/server';
import { getCachedData, cacheData, deleteCachedData, acquireLock, releaseLock } from '@/app/utils/redis';
import fs from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import { detectLanguage, translateText } from './translation';

// --- Variables de Entorno y Constantes ---
const GITHUB_API_BASE_URL = process.env.GITHUB_API_URL || 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPO_OWNER;

const SNAPSHOT_KEY = 'github:repos:public:snapshot';
// Snapshot and translations never expire by time: a stale snapshot beats a slow page, and a translation is
// only replaced when the original text changes (so tokens are never spent twice on the same text).
const FRESH_FOR_MS = 60 * 60 * 1000; // same freshness as before: 1 hour
const INCOMPLETE_RETRY_MS = 5 * 60 * 1000; // pending translations that only lacked budget/time
// Translation failures per repository and text version: wait 5 min, 1 h, 24 h; give up after 4 attempts
// until the original text changes. Never retried in a loop.
const TRANSLATION_RETRY_DELAYS_MS = [5 * 60 * 1000, 60 * 60 * 1000, 24 * 60 * 60 * 1000];
const MAX_TRANSLATION_ATTEMPTS = TRANSLATION_RETRY_DELAYS_MS.length + 1;
// New translations per refresh (cache hits are free and not counted).
const MAX_TRANSLATIONS_PER_REFRESH = 5;
const FAILURE_KEY_PREFIX = 'github:translation-failure:';
const REFRESH_LOCK_KEY = 'github:repos:refresh-lock';
const REFRESH_LOCK_TTL_SECONDS = 120;
// Stop translating and save progress well before the 60 s maxDuration of the routes that refresh
// (one translation can take ~20 s with Gemini's rate-limit backoff).
const REFRESH_BUDGET_MS = 25_000;
const GITHUB_REFRESH_TIMEOUT_MS = 8_000;
const GITHUB_REQUEST_TIMEOUT_MS = 2_500; // request path: never make a visitor wait on GitHub
const MIN_README_LENGTH = 100;
// GitHub repository names: letters, digits, '.', '_' and '-', up to 100 characters ('.' and '..' are reserved).
const VALID_REPO_NAME = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;

// --- Interfaces ---
export interface GitHubRepository {
  id: number;
  name: string;
  full_name?: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  private?: boolean;
  visibility?: string;
}

export interface BilingualContent {
  description: string | null;
  readme: string | null;
}

export interface BilingualRepository extends GitHubRepository {
  originalLanguage: 'es' | 'en';
  languageChangeNotified?: boolean;
  /** false for a placeholder that copies the original text in both languages (never a real translation). */
  translated?: boolean;
  es: BilingualContent;
  en: BilingualContent;
}

export interface RepositoriesSnapshot {
  generatedAt: number;
  /** false while some translation is still pending a retry. */
  complete: boolean;
  /** When the next pending translation may be retried (absent when nothing is pending). */
  retryAt?: number;
  repos: BilingualRepository[];
}

interface TranslationFailure {
  hash: string;
  attempts: number;
  nextRetryAt: number;
}

export const textHash = (description: string | null, readme: string | null) =>
  createHash('sha256').update(`${description ?? ''}\n\n${readme ?? ''}`).digest('hex');

// --- Headers Comunes ---
const commonHeaders: HeadersInit = {
  Accept: 'application/vnd.github.v3+json',
  'X-GitHub-Api-Version': '2022-11-28',
};
if (GITHUB_TOKEN) {
  commonHeaders['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
} else {
  console.warn('Missing GITHUB_TOKEN environment variable. GitHub API rate limits will be lower.');
}

interface FetchOptions {
  timeoutMs: number;
  fresh?: boolean; // bypass the fetch data cache (background refresh)
}

const githubFetch = (url: string, { timeoutMs, fresh }: FetchOptions, headers: HeadersInit = commonHeaders) =>
  fetch(url, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
    ...(fresh ? { cache: 'no-store' as const } : { next: { revalidate: 3600 } }),
  });

// --- README ---
const fetchReadme = async (repoName: string, options: FetchOptions): Promise<string | null> => {
  if (!REPO_OWNER || !repoName) {
    console.error('Missing REPO_OWNER or repoName for getReadmeContent');
    return null;
  }
  const url = `${GITHUB_API_BASE_URL}/repos/${REPO_OWNER}/${encodeURIComponent(repoName)}/readme`;
  try {
    const response = await githubFetch(url, options, { ...commonHeaders, Accept: 'application/vnd.github.raw+json' });
    if (response.ok) return await response.text();
    if (response.status !== 404) {
      console.error(`Failed to fetch README for ${repoName}: ${response.status} ${response.statusText}`);
    }
    return null;
  } catch (error) {
    console.error(`Error fetching README for ${repoName} from GitHub:`, error);
    return null;
  }
};

export const getReadmeContent = cache((repoName: string): Promise<string | null> =>
  fetchReadme(repoName, { timeoutMs: GITHUB_REQUEST_TIMEOUT_MS })
);

// --- Static bilingual fallback (src/data/bilingual-repos-fallback.json) ---
type FallbackEntry = Omit<BilingualRepository, 'description' | 'updated_at'> &
  Partial<Pick<BilingualRepository, 'description' | 'updated_at'>>;

let fallbackCache: Record<string, FallbackEntry> | null = null;

const loadFallbackMap = (): Record<string, FallbackEntry> => {
  if (fallbackCache) return fallbackCache;
  try {
    const filePath = path.join(process.cwd(), 'src/data/bilingual-repos-fallback.json');
    fallbackCache = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
  } catch (err) {
    console.error('[Github bilingual cache] Error reading fallback JSON:', err);
    fallbackCache = {};
  }
  return fallbackCache!;
};

const fromFallback = (entry: FallbackEntry): BilingualRepository => ({
  ...entry,
  description: entry.description ?? entry[entry.originalLanguage]?.description ?? null,
  updated_at: entry.updated_at ?? '',
});

const getFallbackRepositories = (): BilingualRepository[] =>
  Object.values(loadFallbackMap())
    .filter((entry) => (entry[entry.originalLanguage]?.readme?.length ?? 0) >= MIN_README_LENGTH)
    .map(fromFallback);

const untranslated = (repo: GitHubRepository, readme: string | null): BilingualRepository => ({
  id: repo.id,
  name: repo.name,
  html_url: repo.html_url,
  language: repo.language,
  stargazers_count: repo.stargazers_count,
  updated_at: repo.updated_at,
  description: repo.description,
  originalLanguage: 'en',
  translated: false,
  es: { description: repo.description, readme },
  en: { description: repo.description, readme },
});

// --- Translation + per-repository cache (background only) ---
// Returns the bilingual repository and whether Gemini was called. Returns null when a translation is
// needed but not allowed in this run (budget). Throws when Gemini fails, so nothing half-translated is
// ever stored.
export async function processBilingualRepository(
  repoId: number,
  repoName: string,
  htmlUrl: string,
  programmingLang: string | null,
  stars: number,
  updatedAt: string,
  freshDescription: string | null,
  freshReadme: string | null,
  { allowTranslation = true }: { allowTranslation?: boolean } = {}
): Promise<{ repo: BilingualRepository; translated: boolean } | null> {
  const cacheKey = `github:repo:bilingual:${repoName}`;
  const cached: BilingualRepository | null = await getCachedData(cacheKey);

  const cleanDescription = freshDescription || '';
  const cleanReadme = freshReadme || '';
  const combinedContentForDetection = `${cleanDescription}\n\n${cleanReadme}`.trim() || 'No content';
  const metadata = {
    id: repoId,
    name: repoName,
    html_url: htmlUrl,
    language: programmingLang,
    stargazers_count: stars,
    updated_at: updatedAt,
    description: freshDescription,
  };

  // 1. Same text as the cached version: reuse its translations (zero AI cost), refresh metadata.
  if (cached) {
    const cachedOriginalContent = cached[cached.originalLanguage];
    if (
      (cachedOriginalContent.description || '') === cleanDescription &&
      (cachedOriginalContent.readme || '') === cleanReadme
    ) {
      const refreshed = { ...cached, ...metadata };
      if (cached.stargazers_count !== stars || cached.updated_at !== updatedAt) {
        await cacheData(cacheKey, refreshed);
      }
      return { repo: refreshed, translated: false };
    }
  }

  // 2. Same text as the static pre-translated fallback.
  const localFallback = loadFallbackMap()[repoName];
  if (!cached && localFallback && localFallback.translated !== false) {
    const origContent = localFallback[localFallback.originalLanguage];
    if (origContent.description === freshDescription && origContent.readme === freshReadme) {
      const fromStatic = { ...fromFallback(localFallback), ...metadata };
      await cacheData(cacheKey, fromStatic);
      return { repo: fromStatic, translated: false };
    }
  }

  // 3. New or changed text: detect language and translate (only if this run still has budget).
  if (!allowTranslation) return null;
  console.log(`[Github bilingual cache] Translating ${repoName}...`);
  const detectedLang = await detectLanguage(combinedContentForDetection);
  const oppositeLang = detectedLang === 'es' ? 'en' : 'es';
  const translatedDescription = cleanDescription ? await translateText(cleanDescription, oppositeLang) : null;
  const translatedReadme = cleanReadme ? await translateText(cleanReadme, oppositeLang) : null;

  const languageChangeNotified = Boolean(cached && cached.originalLanguage !== detectedLang);
  if (languageChangeNotified) {
    console.warn(`[Language Change Warning] Repo "${repoName}" primary language changed from "${cached!.originalLanguage}" to "${detectedLang}".`);
  }

  const original = { description: freshDescription, readme: freshReadme };
  const translated = { description: translatedDescription, readme: translatedReadme };
  const result: BilingualRepository = {
    ...metadata,
    originalLanguage: detectedLang,
    ...(languageChangeNotified ? { languageChangeNotified } : {}),
    es: detectedLang === 'es' ? original : translated,
    en: detectedLang === 'en' ? original : translated,
  };

  await cacheData(cacheKey, result);
  return { repo: result, translated: true };
}

// --- Snapshot helpers ---
const isSnapshot = (value: unknown): value is RepositoriesSnapshot =>
  Boolean(value && typeof value === 'object' && Array.isArray((value as RepositoriesSnapshot).repos));

const needsRefresh = (snapshot: RepositoriesSnapshot, now = Date.now()) =>
  now - snapshot.generatedAt > FRESH_FOR_MS || (snapshot.retryAt !== undefined && now >= snapshot.retryAt);

const readSnapshot = async (): Promise<RepositoriesSnapshot | null> => {
  const value = await getCachedData(SNAPSHOT_KEY);
  return isSnapshot(value) ? value : null;
};

// Schedules a background refresh after the response is sent. Outside a request scope
// (e.g. generateStaticParams) `after` is unavailable, and during `next build` it is skipped on
// purpose: the build serves the snapshot or the static fallback and production refreshes later.
const scheduleRefresh = () => {
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  try {
    after(() => refreshPublicRepositories());
  } catch {
    // Not in a request/prerender scope.
  }
};

// --- REFRESH (background) ---
const fetchRepositoryList = async (): Promise<GitHubRepository[]> => {
  const url = `${GITHUB_API_BASE_URL}/users/${REPO_OWNER}/repos?type=public&sort=updated&per_page=100`;
  const response = await githubFetch(url, { timeoutMs: GITHUB_REFRESH_TIMEOUT_MS, fresh: true });
  if (!response.ok) {
    throw new Error(`Failed to fetch repository list: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as GitHubRepository[];
};

export async function refreshPublicRepositories(): Promise<RepositoriesSnapshot | null> {
  if (!REPO_OWNER) {
    console.error('Missing GITHUB_REPO_OWNER environment variable');
    return null;
  }
  if (!(await acquireLock(REFRESH_LOCK_KEY, REFRESH_LOCK_TTL_SECONDS))) {
    return null; // another refresh is already running
  }

  const deadline = Date.now() + REFRESH_BUDGET_MS;
  try {
    const list = await fetchRepositoryList();
    const withReadme = await Promise.all(
      list.map(async (repo) => ({
        repo,
        readme: await fetchReadme(repo.name, { timeoutMs: GITHUB_REFRESH_TIMEOUT_MS, fresh: true }),
      }))
    );
    const valid = withReadme.filter((item) => (item.readme?.length ?? 0) >= MIN_README_LENGTH);

    const previous = await readSnapshot();
    const previousByName = new Map(previous?.repos.map((repo) => [repo.name, repo]) ?? []);
    const fallback = loadFallbackMap();

    const repos: BilingualRepository[] = [];
    let translationsLeft = MAX_TRANSLATIONS_PER_REFRESH;
    let retryAt: number | undefined;
    const scheduleRetry = (at: number) => {
      retryAt = retryAt === undefined ? at : Math.min(retryAt, at);
    };

    for (const { repo, readme } of valid) {
      const hash = textHash(repo.description, readme);
      const failureKey = `${FAILURE_KEY_PREFIX}${repo.name}`;
      const storedFailure: TranslationFailure | null = await getCachedData(failureKey);
      const failure = storedFailure?.hash === hash ? storedFailure : null;
      const gaveUp = failure !== null && failure.attempts >= MAX_TRANSLATION_ATTEMPTS;
      const waiting = failure !== null && !gaveUp && Date.now() < failure.nextRetryAt;
      const allowTranslation = !gaveUp && !waiting && translationsLeft > 0 && Date.now() < deadline;

      try {
        const result = await processBilingualRepository(
          repo.id, repo.name, repo.html_url, repo.language,
          repo.stargazers_count, repo.updated_at, repo.description, readme,
          { allowTranslation }
        );
        if (result) {
          if (result.translated) translationsLeft--;
          if (storedFailure) await deleteCachedData(failureKey); // resolved, or the text changed
          repos.push(result.repo);
          continue;
        }
        // Needs a translation that this run could not do.
        if (waiting) scheduleRetry(failure!.nextRetryAt);
        else if (!gaveUp) scheduleRetry(Date.now() + INCOMPLETE_RETRY_MS);
      } catch (err) {
        translationsLeft--;
        const attempts = (failure?.attempts ?? 0) + 1;
        const delay = TRANSLATION_RETRY_DELAYS_MS[attempts - 1];
        const nextRetryAt = delay === undefined ? Number.MAX_SAFE_INTEGER : Date.now() + delay;
        await cacheData(failureKey, { hash, attempts, nextRetryAt } satisfies TranslationFailure);
        if (delay !== undefined) scheduleRetry(nextRetryAt);
        console.error(
          `[Github bilingual cache] Could not translate ${repo.name} (attempt ${attempts}/${MAX_TRANSLATION_ATTEMPTS}); keeping the previous version:`,
          err instanceof Error ? err.message : err
        );
      }

      const known = previousByName.get(repo.name) ?? (fallback[repo.name] && fromFallback(fallback[repo.name]));
      repos.push(
        known
          ? { ...known, stargazers_count: repo.stargazers_count, updated_at: repo.updated_at, html_url: repo.html_url }
          : untranslated(repo, readme)
      );
    }

    const snapshot: RepositoriesSnapshot = {
      generatedAt: Date.now(),
      complete: retryAt === undefined,
      ...(retryAt !== undefined ? { retryAt } : {}),
      repos,
    };
    await cacheData(SNAPSHOT_KEY, snapshot);
    console.log(
      `[Github bilingual cache] Snapshot refreshed: ${repos.length} repositories, ` +
        `${MAX_TRANSLATIONS_PER_REFRESH - translationsLeft} Gemini translations, pending retry: ${retryAt ? new Date(retryAt).toISOString() : 'none'}.`
    );
    await releaseLock(REFRESH_LOCK_KEY);
    return snapshot;
  } catch (error) {
    // The lock is kept until it expires: it doubles as a cooldown so an outage is not retried
    // on every request.
    console.error('[Github bilingual cache] Refresh failed; keeping the previous snapshot:', error);
    return null;
  }
}

// --- READ (request path) ---
// `scheduleRefreshIfStale` is only passed by routes that declare `maxDuration = 60` (/repositories and
// /api/agent-context), so the background refresh never runs inside a short default function limit.
export const getPublicRepositories = cache(async (scheduleRefreshIfStale = false): Promise<BilingualRepository[]> => {
  if (!REPO_OWNER) {
    console.error('Missing GITHUB_REPO_OWNER environment variable');
    return [];
  }

  const snapshot = await readSnapshot();
  if (snapshot) {
    if (scheduleRefreshIfStale && needsRefresh(snapshot)) scheduleRefresh();
    return snapshot.repos;
  }

  if (scheduleRefreshIfStale) scheduleRefresh();
  return getFallbackRepositories();
});

const findByName = <T extends { name: string }>(items: T[], repoName: string): T | undefined => {
  const lower = repoName.toLowerCase();
  return items.find((item) => item.name === repoName) ?? items.find((item) => item.name.toLowerCase() === lower);
};

export const getRepositoryByName = cache(async (repoName: string): Promise<BilingualRepository | null> => {
  if (!REPO_OWNER) {
    console.error('Missing GITHUB_REPO_OWNER environment variable');
    return null;
  }
  // An impossible name cannot exist on GitHub: answer 404 without calling it.
  if (!VALID_REPO_NAME.test(repoName)) return null;

  // The snapshot is the published list: what is not in it does not exist for visitors (deleted,
  // private or filtered repositories), and unknown names never reach GitHub.
  const snapshot = await readSnapshot();
  if (snapshot) return findByName(snapshot.repos, repoName) ?? null;

  // No snapshot yet (first deploy, Redis empty or unavailable).
  const cachedRepo: BilingualRepository | null = await getCachedData(`github:repo:bilingual:${repoName}`);
  if (cachedRepo) return cachedRepo;

  const fallbackEntry = findByName(Object.values(loadFallbackMap()), repoName);
  if (fallbackEntry) return fromFallback(fallbackEntry);

  // Unknown everywhere: ask GitHub directly, briefly. 404 means it does not exist; any other
  // failure is an error (it must not be reported as "not found").
  const url = `${GITHUB_API_BASE_URL}/repos/${REPO_OWNER}/${encodeURIComponent(repoName)}`;
  const response = await githubFetch(url, { timeoutMs: GITHUB_REQUEST_TIMEOUT_MS });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to fetch repository details for ${repoName}: ${response.status} ${response.statusText}`);
  }
  const repoDetails = (await response.json()) as GitHubRepository;
  // The token can read private repositories: never publish one.
  if (repoDetails.private || (repoDetails.visibility && repoDetails.visibility !== 'public')) return null;
  const readme = await getReadmeContent(repoDetails.name);
  return untranslated(repoDetails, readme);
});
