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
      className="flex flex-col items-center gap-5 rounded-3xl bg-night-soft p-6 ring-1 ring-cream/10"
    >
      <div className="flex flex-col items-center gap-1">
        <p className="text-base font-semibold text-cream/70">Código de la sala</p>
        <p className="font-mono text-6xl font-bold tracking-[0.2em] text-moon">{code}</p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
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
