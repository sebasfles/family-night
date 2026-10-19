import { useEffect, useState, type ReactNode } from 'react';
import { REVEAL_FLIP_DELAY_MS } from './timing';
import { useReducedMotion } from './useReducedMotion';

interface FlipProps {
  flipped: boolean;
  back: ReactNode;
  front: ReactNode;
  className?: string;
}

export function Flip({ flipped, back, front, className = '' }: FlipProps) {
  const reduced = useReducedMotion();
  const [frontMounted, setFrontMounted] = useState(flipped);
  if (flipped && !frontMounted) setFrontMounted(true);

  if (reduced) return <span className={`grid ${className}`}>{flipped ? front : back}</span>;

  return (
    <span className={`grid perspective-[1400px] ${className}`}>
      <span
        data-flip={flipped ? 'front' : 'back'}
        className="grid transition-transform duration-700 ease-soft [grid-area:1/1] transform-3d"
        style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && !flipped) setFrontMounted(false);
        }}
      >
        <span aria-hidden={flipped || undefined} className="grid [grid-area:1/1] backface-hidden">
          {back}
        </span>
        <span
          aria-hidden={!flipped || undefined}
          className="grid rotate-y-180 [grid-area:1/1] backface-hidden"
        >
          {frontMounted && front}
        </span>
      </span>
    </span>
  );
}

interface FlipRevealProps {
  back: ReactNode;
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

export function FlipReveal({
  back,
  children,
  delayMs = REVEAL_FLIP_DELAY_MS,
  className = '',
}: FlipRevealProps) {
  const reduced = useReducedMotion();
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => {
      setFlipped(true);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [reduced, delayMs]);

  if (reduced) return <span className={`grid ${className}`}>{children}</span>;
  return <Flip flipped={flipped} back={back} front={children} className={className} />;
}
