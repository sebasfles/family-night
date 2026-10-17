import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { clearIdentity } from './identity/storage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  clearIdentity();
  localStorage.clear();
});
