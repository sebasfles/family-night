import { useEffect, useRef } from 'react';

export function useEnterKey(action: () => void): void {
  const latest = useRef(action);
  useEffect(() => {
    latest.current = action;
  }, [action]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || event.defaultPrevented) return;
      if (event.target !== document.body) return;
      event.preventDefault();
      latest.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, []);
}
