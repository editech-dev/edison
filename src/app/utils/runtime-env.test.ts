import { describe, it, expect } from 'vitest';
import { LOCAL_REDIS_URL, isLocalRedisUrl, isProduction, resolveGeminiApiKey, resolveRedisUrl } from './runtime-env';

const PROD_REDIS = 'rediss://user:secret@prod.example.com:6380';

describe('runtime-env', () => {
  it('only Vercel production counts as production', () => {
    expect(isProduction({ VERCEL: '1', VERCEL_ENV: 'production' })).toBe(true);
    expect(isProduction({})).toBe(false);
    expect(isProduction({ VERCEL_ENV: 'preview' })).toBe(false);
    expect(isProduction({ NODE_ENV: 'production' })).toBe(false); // `bun run start` on the laptop
  });

  it('production reads REDIS_URL', () => {
    expect(resolveRedisUrl({ VERCEL: '1', VERCEL_ENV: 'production', REDIS_URL: PROD_REDIS })).toBe(PROD_REDIS);
  });

  it('development never reads REDIS_URL, even if .env.local has the production one', () => {
    expect(resolveRedisUrl({ REDIS_URL: PROD_REDIS })).toBe(LOCAL_REDIS_URL);
    expect(resolveRedisUrl({ REDIS_URL: PROD_REDIS, NODE_ENV: 'production' })).toBe(LOCAL_REDIS_URL);
    expect(resolveRedisUrl({ REDIS_URL: PROD_REDIS, VERCEL_ENV: 'preview' })).toBe(LOCAL_REDIS_URL);
  });

  it('development can point to another local Redis or disable it', () => {
    expect(resolveRedisUrl({ REDIS_DEV_URL: 'redis://127.0.0.1:7000' })).toBe('redis://127.0.0.1:7000');
    expect(resolveRedisUrl({ REDIS_DEV_URL: 'memory', REDIS_URL: PROD_REDIS })).toBeUndefined();
  });

  it('development prefers a dedicated Gemini key; production always uses the production key', () => {
    expect(resolveGeminiApiKey({ GEMINI_API_KEY: 'prod', GEMINI_API_KEY_DEV: 'dev' })).toBe('dev');
    expect(resolveGeminiApiKey({ GEMINI_API_KEY: 'prod' })).toBe('prod');
    expect(resolveGeminiApiKey({ VERCEL: '1', VERCEL_ENV: 'production', GEMINI_API_KEY: 'prod', GEMINI_API_KEY_DEV: 'dev' })).toBe('prod');
  });

  it('a pulled .env.local with VERCEL_ENV=production does not make the laptop production', () => {
    expect(isProduction({ VERCEL_ENV: 'production' })).toBe(false);
    expect(resolveRedisUrl({ VERCEL_ENV: 'production', REDIS_URL: PROD_REDIS })).toBe(LOCAL_REDIS_URL);
  });

  it('accepts only literal loopback addresses for development Redis', () => {
    expect(isLocalRedisUrl('redis://127.0.0.1:6399')).toBe(true);
    expect(isLocalRedisUrl('redis://[::1]:6399')).toBe(true);
    for (const url of ['redis://localhost:6399', 'redis://0.0.0.0:6379', 'redis://localhost.attacker.com', 'redis://127.0.0.1@evil.com:6379', PROD_REDIS, 'nonsense']) {
      expect(isLocalRedisUrl(url)).toBe(false);
    }
    expect(resolveRedisUrl({ REDIS_DEV_URL: 'redis://prod.example.com:6379' })).toBe(LOCAL_REDIS_URL);
  });
});
