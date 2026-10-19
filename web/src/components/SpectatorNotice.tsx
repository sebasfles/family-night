import { Enter } from '../motion/motion';
import { EyeIcon } from './icons';

export function SpectatorNotice() {
  return (
    <Enter className="flex items-center gap-4 surface p-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-lagoon/14 text-lagoon">
        <EyeIcon className="size-7" />
      </span>
      <p role="status" className="text-lg font-semibold text-balance">
        Partida en curso, juegas en la siguiente
      </p>
    </Enter>
  );
}
