import type { ReactNode } from 'react';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 py-12 text-center">
      {children}
    </main>
  );
}
