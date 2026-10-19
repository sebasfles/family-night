import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Fade, Pop, SlideIn, SlideUp } from '../motion/motion';
import { Backdrop } from './Backdrop';
import { Button } from './Button';
import { CloseIcon } from './icons';
import { useWideScreen } from './useWideScreen';

export interface HowToPlayStep {
  title: string;
  text: string;
  Scene: ComponentType;
}

interface HowToPlayProps {
  game: string;
  steps: HowToPlayStep[];
  onClose: () => void;
}

const SWIPE_PX = 48;
const DRAG_CLOSE_PX = 96;

export function HowToPlay({ game, steps, onClose }: HowToPlayProps) {
  const wide = useWideScreen();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(0);
  const [from, setFrom] = useState<1 | -1>(1);

  const go = (next: number) => {
    if (next < 0 || next >= steps.length) return;
    setFrom(next > index ? 1 : -1);
    setIndex(next);
  };

  const keys = useRef({ onClose, index, go });
  useEffect(() => {
    keys.current = { onClose, index, go };
  });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') keys.current.onClose();
      const { index: current, go: goTo } = keys.current;
      if (event.key === 'ArrowRight') goTo(current + 1);
      if (event.key === 'ArrowLeft') goTo(current - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  const carousel = (
    <Carousel
      titleId={titleId}
      game={game}
      steps={steps}
      index={index}
      from={from}
      closeRef={closeRef}
      onGo={go}
      onClose={onClose}
    />
  );

  if (wide) {
    return (
      <Backdrop>
        <Pop
          role="dialog"
          aria-modal
          aria-labelledby={titleId}
          className="flex max-h-[min(90dvh,52rem)] w-full max-w-lg flex-col surface"
        >
          {carousel}
        </Pop>
      </Backdrop>
    );
  }
  return (
    <Drawer titleId={titleId} onClose={onClose}>
      {carousel}
    </Drawer>
  );
}

function Drawer({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<number | null>(null);
  const dragged = useRef(false);

  const release = (event: PointerEvent<HTMLButtonElement>) => {
    if (start.current === null) return;
    const distance = Math.max(0, event.clientY - start.current);
    start.current = null;
    setDrag(null);
    if (distance >= DRAG_CLOSE_PX) onClose();
  };

  return (
    <Fade className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 backdrop-blur-[2px]">
      <SlideUp role="dialog" aria-modal aria-labelledby={titleId} className="w-full">
        <div
          style={drag ? { transform: `translateY(${String(drag)}px)` } : undefined}
          className={`flex max-h-[92dvh] flex-col rounded-t-card bg-night-soft pb-[env(safe-area-inset-bottom)] shadow-lift ring-1 ring-cream/8 ${
            drag === null
              ? 'transition-transform duration-200 ease-soft motion-reduce:transition-none'
              : ''
          }`}
        >
          <button
            type="button"
            aria-label="Arrastra para cerrar"
            onPointerDown={(event) => {
              start.current = event.clientY;
              dragged.current = false;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (start.current === null) return;
              const distance = Math.max(0, event.clientY - start.current);
              if (distance > 4) dragged.current = true;
              setDrag(distance);
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onClick={() => {
              if (dragged.current) dragged.current = false;
              else onClose();
            }}
            className="flex h-8 w-full shrink-0 touch-none items-center justify-center rounded-t-card focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
          >
            <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-cream/25" />
          </button>
          {children}
        </div>
      </SlideUp>
    </Fade>
  );
}

interface CarouselProps {
  titleId: string;
  game: string;
  steps: HowToPlayStep[];
  index: number;
  from: 1 | -1;
  closeRef: RefObject<HTMLButtonElement | null>;
  onGo: (index: number) => void;
  onClose: () => void;
}

function Carousel({ titleId, game, steps, index, from, closeRef, onGo, onClose }: CarouselProps) {
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const step = steps[index];
  if (!step) return null;
  const last = index === steps.length - 1;
  const { Scene } = step;

  return (
    <>
      <header className="flex items-center justify-between gap-3 px-5 pt-1 sm:px-6 sm:pt-5">
        <div className="flex min-w-0 flex-col">
          <p className="text-sm font-bold tracking-[0.18em] text-cream/60 uppercase">Cómo jugar</p>
          <h2 id={titleId} className="text-2xl font-bold break-words">
            {game}
          </h2>
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="flex size-12 shrink-0 items-center justify-center rounded-full text-cream/80 transition-colors hover:bg-cream/8 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
        >
          <CloseIcon className="size-6" />
        </button>
      </header>

      <div
        className="min-h-0 flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 sm:px-6"
        onPointerDown={(event) => {
          swipe.current =
            event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          if (!swipe.current) return;
          const dx = event.clientX - swipe.current.x;
          const dy = event.clientY - swipe.current.y;
          swipe.current = null;
          if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          onGo(dx < 0 ? index + 1 : index - 1);
        }}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        <SlideIn key={index} from={from} className="flex flex-col gap-5">
          <div
            role="group"
            aria-roledescription="paso"
            aria-label={`Paso ${String(index + 1)} de ${String(steps.length)}`}
            className="flex flex-col gap-1.5"
          >
            <h3 className="text-xl font-bold text-moon">{step.title}</h3>
            <p className="text-lg text-cream/85">{step.text}</p>
          </div>
          <div inert className="flex flex-col gap-4 select-none">
            <Scene />
          </div>
        </SlideIn>
      </div>

      <footer className="flex flex-col gap-3 border-t border-cream/8 px-5 pt-3 pb-4 sm:px-6 sm:pb-5">
        <ol aria-hidden="true" className="flex justify-center gap-2">
          {steps.map((entry, dot) => (
            <li
              key={entry.title}
              className={`h-2 rounded-full transition-[width,background-color] duration-300 ease-soft motion-reduce:transition-none ${
                dot === index ? 'w-6 bg-moon' : 'w-2 bg-cream/25'
              }`}
            />
          ))}
        </ol>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            disabled={index === 0}
            onClick={() => {
              onGo(index - 1);
            }}
          >
            Anterior
          </Button>
          <Button
            onClick={() => {
              if (last) onClose();
              else onGo(index + 1);
            }}
          >
            {last ? '¡A jugar!' : 'Siguiente'}
          </Button>
        </div>
      </footer>
    </>
  );
}
