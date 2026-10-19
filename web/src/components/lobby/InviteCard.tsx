import { roomUrl } from '@family-night/shared';
import { Button } from '../Button';
import { LinkIcon, ShareIcon } from '../icons';
import { useToast } from '../useToast';
import { copyText, shareRoom } from './invite';

export function InviteCard({ code }: { code: string }) {
  const toast = useToast();
  const url = roomUrl(window.location.origin, code);

  const copy = async () => {
    toast((await copyText(url)) ? '¡Link copiado!' : 'No pudimos copiar el link');
  };

  const share = async () => {
    try {
      await shareRoom(url);
    } catch {
      toast('No pudimos compartir el link');
    }
  };

  return (
    <section
      aria-label="Invitar a la sala"
      className="relative flex flex-col items-center gap-5 overflow-hidden surface p-6"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 size-56 -translate-x-1/2 rounded-full bg-moon/20 blur-3xl"
      />
      <div className="relative flex flex-col items-center gap-3">
        <p className="text-sm font-bold tracking-[0.18em] text-cream/70 uppercase">
          Código de la sala
        </p>
        <p className="flex gap-2">
          <span className="sr-only">{code}</span>
          {Array.from(code).map((letter, index) => (
            <span
              key={index}
              aria-hidden="true"
              className="flex h-18 w-15 items-center justify-center rounded-2xl bg-night font-display text-5xl font-bold text-moon shadow-[inset_0_-4px_0_rgb(0_0_0/0.35)] ring-1 ring-moon/30"
            >
              {letter}
            </span>
          ))}
        </p>
      </div>
      <div className="relative flex w-full flex-col gap-3 sm:flex-row">
        <Button variant="secondary" className="sm:flex-1" onClick={() => void copy()}>
          <LinkIcon className="size-5" />
          Copiar link
        </Button>
        <Button className="sm:flex-1" onClick={() => void share()}>
          <ShareIcon className="size-5" />
          Compartir
        </Button>
      </div>
    </section>
  );
}
