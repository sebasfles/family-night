import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 768px)';

function media(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;
}

function subscribe(onChange: () => void): () => void {
  const list = media();
  list?.addEventListener('change', onChange);
  return () => {
    list?.removeEventListener('change', onChange);
  };
}

export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, () => media()?.matches ?? false);
}
