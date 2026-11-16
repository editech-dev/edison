import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// `bun run` loads .env.local into process.env: tests must never see real services or secrets.
for (const name of ['REDIS_URL', 'REDIS_DEV_URL', 'GEMINI_API_KEY', 'GEMINI_API_KEY_DEV', 'GITHUB_TOKEN', 'ADMIN_API_TOKEN', 'VERCEL_ENV']) {
  delete process.env[name];
}
// No Redis at all in tests (in-memory store), unless a test configures one explicitly.
process.env.REDIS_DEV_URL = 'memory';

// Clean up DOM and reset mocks after each test run
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
