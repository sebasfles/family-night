import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { clearIdentity } from './identity/storage';

Object.defineProperty(window, 'scrollTo', { configurable: true, value: () => undefined });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
  clearIdentity();
  localStorage.clear();
});
