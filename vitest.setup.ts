import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Clean up DOM and reset mocks after each test run
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
