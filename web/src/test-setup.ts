import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { clearIdentity } from './identity/storage';
import { stubReducedMotion } from './test/motion';

Object.defineProperty(window, 'scrollTo', { configurable: true, value: () => undefined });

beforeEach(() => {
  stubReducedMotion(true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
  clearIdentity();
  localStorage.clear();
  sessionStorage.clear();
});
