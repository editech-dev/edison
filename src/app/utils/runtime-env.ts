// Where the code runs decides which data it may touch.
//
// Vercel only hosts production for this project (no previews) and injects VERCEL_ENV=production by itself.
// Anything else (the developer's machine, containers, tests, agents) is development: it must never read
// the production Redis, even if REDIS_URL is present in .env.local.

/** Local Redis started with `bun run redis:up` (docker-compose.yml). */
export const LOCAL_REDIS_URL = 'redis://127.0.0.1:6399';

type Env = Record<string, string | undefined>;

// Both variables are injected by Vercel itself. Requiring VERCEL=1 too means that a `.env.local` produced by
// `vercel env pull --environment=production` (which writes VERCEL_ENV) never makes the laptop "production".
export const isProduction = (env: Env = process.env): boolean => env.VERCEL === '1' && env.VERCEL_ENV === 'production';

const LOCAL_HOSTS = new Set(['127.0.0.1', '[::1]']);

/** True only for a Redis URL on a literal loopback address (no host names that DNS could redirect). */
export const isLocalRedisUrl = (url: string): boolean => {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
};

/** For local scripts: exits unless the URL is a loopback Redis. */
export const assertLocalRedis = (url: string, action: string): void => {
  if (!isLocalRedisUrl(url)) {
    console.error(`Refusing to ${action} a non-local Redis. Only 127.0.0.1 or [::1] are allowed in development.`);
    process.exit(1);
  }
};

/**
 * Production: REDIS_URL. Development: REDIS_DEV_URL or the local Docker Redis; REDIS_URL is ignored.
 * `REDIS_DEV_URL=memory` disables Redis (in-memory store only), which the test suite uses.
 */
export const resolveRedisUrl = (env: Env = process.env): string | undefined => {
  if (isProduction(env)) return env.REDIS_URL || undefined;
  if (env.REDIS_DEV_URL === 'memory') return undefined;
  if (env.REDIS_DEV_URL && !isLocalRedisUrl(env.REDIS_DEV_URL)) {
    console.warn('REDIS_DEV_URL is not a loopback address; using the local Docker Redis instead.');
    return LOCAL_REDIS_URL;
  }
  return env.REDIS_DEV_URL || LOCAL_REDIS_URL;
};

/** Production: GEMINI_API_KEY. Development: GEMINI_API_KEY_DEV when set, so tests do not spend production quota. */
export const resolveGeminiApiKey = (env: Env = process.env): string | undefined =>
  isProduction(env) ? env.GEMINI_API_KEY : env.GEMINI_API_KEY_DEV || env.GEMINI_API_KEY;
