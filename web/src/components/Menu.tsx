import { useEffect, useRef, useState } from 'react';
import { Pop } from '../motion/motion';
import { MoreIcon } from './icons';

export interface MenuItem {
  label: string;
  danger?: boolean;
  onSelect: () => void;
}

export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !ref.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className={`flex size-12 items-center justify-center rounded-full text-cream/80 transition-colors hover:bg-cream/8 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none ${open ? 'bg-cream/10' : ''}`}
      >
        <MoreIcon className="size-6" />
      </button>
      {open && (
        <Pop
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 flex w-56 origin-top-right flex-col overflow-hidden popover p-1.5"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`min-h-12 rounded-xl px-4 text-left font-bold transition-colors hover:bg-cream/8 focus-visible:bg-cream/10 focus-visible:outline-none ${item.danger ? 'text-ember' : 'text-cream'}`}
            >
              {item.label}
            </button>
          ))}
        </Pop>
      )}
    </div>
  );
}
