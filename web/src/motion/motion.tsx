import {
  domAnimation,
  LazyMotion,
  MotionConfig,
  type Transition,
  type Variants,
} from 'motion/react';
import * as m from 'motion/react-m';
import type { ReactNode } from 'react';
import { COUNT_DELAY_MS, COUNT_MS } from './timing';
import { useReducedMotion } from './useReducedMotion';

const EASE = [0.22, 1, 0.36, 1] as const;

const SOFT: Transition = { duration: 0.42, ease: EASE };

export function MotionProvider({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig
        reducedMotion={reduced ? 'always' : 'never'}
        transition={reduced ? { duration: 0 } : SOFT}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

const rise: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  shown: { opacity: 1, y: 0, scale: 1 },
};

const tags = { div: m.div, section: m.section, li: m.li, main: m.main } as const;

interface BlockProps {
  as?: keyof typeof tags;
  className?: string;
  children: ReactNode;
  role?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-current'?: 'true';
  'aria-modal'?: boolean;
}

export function Enter({
  as = 'div',
  delay = 0,
  children,
  ...rest
}: BlockProps & { delay?: number }) {
  const reduced = useReducedMotion();
  const Tag = tags[as];
  return (
    <Tag
      variants={rise}
      initial={reduced ? false : 'hidden'}
      animate="shown"
      transition={{ ...SOFT, delay }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

const STAGGER_S = 0.06;

export function Stagger({ className, children }: { className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className={className}
      initial={reduced ? false : 'hidden'}
      animate="shown"
      variants={{ hidden: {}, shown: { transition: { staggerChildren: STAGGER_S } } }}
    >
      {children}
    </m.div>
  );
}

export function StaggerItem({ as = 'div', children, ...rest }: BlockProps) {
  const reduced = useReducedMotion();
  const Tag = tags[as];
  return (
    <Tag variants={rise} initial={reduced ? false : undefined} {...rest}>
      {children}
    </Tag>
  );
}

const pop: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.96 },
  shown: { opacity: 1, y: 0, scale: 1 },
};

export function Pop({ as = 'div', children, ...rest }: BlockProps) {
  const reduced = useReducedMotion();
  const Tag = tags[as];
  return (
    <Tag
      variants={pop}
      initial={reduced ? false : 'hidden'}
      animate="shown"
      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Fade({ className, children }: { className?: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <m.div
      className={className}
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </m.div>
  );
}

export function Meter({ fraction, className }: { fraction: number; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <m.span
      className={className}
      initial={reduced ? false : { width: '0%' }}
      animate={{ width: `${String(Math.round(fraction * 1000) / 10)}%` }}
      transition={{ ...SOFT, duration: COUNT_MS / 1000, delay: COUNT_DELAY_MS / 1000 }}
    />
  );
}
