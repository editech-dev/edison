// Where the code runs decides which data it may touch.
//
// Vercel only hosts production for this project (no previews) and injects VERCEL_ENV=production by itself.
// Anything else (the developer's machine, containers, tests, agents) is development: it must never read
// the production Redis, even if REDIS_URL is present in .env.local.

/** Local Redis started with `bun run redis:up` (docker-compose.yml). */
export const LOCAL_REDIS_URL = 'redis://127.0.0.1:6399';

type Env = Record<string, string | undefined>;

export const isProduction = (env: Env = process.env): boolean => env.VERCEL_ENV === 'production';

/**
 * Production: REDIS_URL. Development: REDIS_DEV_URL or the local Docker Redis; REDIS_URL is ignored.
 * `REDIS_DEV_URL=memory` disables Redis (in-memory store only), which the test suite uses.
 */
export const resolveRedisUrl = (env: Env = process.env): string | undefined => {
  if (isProduction(env)) return env.REDIS_URL || undefined;
  if (env.REDIS_DEV_URL === 'memory') return undefined;
  return env.REDIS_DEV_URL || LOCAL_REDIS_URL;
};

/** Production: GEMINI_API_KEY. Development: GEMINI_API_KEY_DEV when set, so tests do not spend production quota. */
export const resolveGeminiApiKey = (env: Env = process.env): string | undefined =>
  isProduction(env) ? env.GEMINI_API_KEY : env.GEMINI_API_KEY_DEV || env.GEMINI_API_KEY;
