import type { ReactNode } from 'react';
import { Fade } from '../motion/motion';

export function Backdrop({ children }: { children: ReactNode }) {
  return (
    <Fade className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 p-4 backdrop-blur-[2px] sm:items-center">
      {children}
    </Fade>
  );
}
