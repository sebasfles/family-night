import type { ReactNode } from 'react';

export function Waiting({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-center text-xl font-semibold text-balance">
      <span aria-hidden="true" className="mr-3 inline-flex gap-1 align-middle">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 rounded-full bg-moon motion-safe:animate-pulse"
            style={{ animationDelay: `${String(delay)}ms` }}
          />
        ))}
      </span>
      {children}
    </p>
  );
}
