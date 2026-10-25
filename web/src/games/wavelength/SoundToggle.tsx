import { SoundIcon } from '../../components/icons';

export function SoundToggle({ sound, onToggle }: { sound: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={sound}
      aria-label="Sonido del dial"
      onClick={onToggle}
      className="flex size-12 items-center justify-center self-end rounded-full bg-night-soft text-cream/80 ring-1 ring-cream/10 hover:bg-night-raised focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none aria-pressed:text-moon"
    >
      <SoundIcon muted={!sound} className="size-6" />
    </button>
  );
}
