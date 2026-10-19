import type { ReactNode } from 'react';

export function Waiting({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-center justify-center gap-3 text-center text-xl font-semibold text-balance"
    >
      <span aria-hidden="true" className="flex shrink-0 gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 rounded-full bg-moon motion-safe:animate-pulse"
            style={{ animationDelay: `${String(delay)}ms` }}
          />
        ))}
      </span>
      <span>{children}</span>
    </p>
  );
}
