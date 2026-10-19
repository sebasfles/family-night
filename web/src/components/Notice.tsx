import type { ReactNode } from 'react';
import { Enter } from '../motion/motion';

export function Notice({ children }: { children: ReactNode }) {
  return (
    <Enter className="flex items-center gap-3 rounded-2xl bg-sand/10 px-4 py-3 ring-1 ring-sand/25">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-sand" />
      <p role="status" className="text-base font-semibold text-balance text-sand">
        {children}
      </p>
    </Enter>
  );
}
