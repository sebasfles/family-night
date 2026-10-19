import type { GameType } from '@family-night/shared';
import type { ComponentType } from 'react';
import { Stagger, StaggerItem } from '../../motion/motion';
import { CheckIcon, CluesIcon, CowIcon, DialIcon, MaskIcon } from '../icons';

interface Game {
  id: GameType;
  name: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  tone: string;
}

const GAMES: Game[] = [
  {
    id: 'IMPOSTOR',
    name: 'Impostor',
    description: 'Todos tienen la palabra, menos el impostor.',
    Icon: MaskIcon,
    tone: 'text-ember bg-ember/14',
  },
  {
    id: 'WAVELENGTH',
    name: 'Wavelength',
    description: 'Lee la mente de tu familia en una escala.',
    Icon: DialIcon,
    tone: 'text-moon bg-moon/14',
  },
  {
    id: 'JUST_ONE',
    name: 'Just One',
    description: 'Pistas de una palabra para adivinar juntos.',
    Icon: CluesIcon,
    tone: 'text-orchid bg-orchid/14',
  },
  {
    id: 'MANADA',
    name: 'La manada',
    description: 'Responde lo mismo que la mayoría.',
    Icon: CowIcon,
    tone: 'text-rose bg-rose/14',
  },
];

interface GamePickerProps {
  selected: GameType;
  editable: boolean;
  onSelect: (game: GameType) => void;
  onHowToPlay: (game: GameType, name: string) => void;
}

export function GamePicker({ selected, editable, onSelect, onHowToPlay }: GamePickerProps) {
  return (
    <section aria-labelledby="games-title" className="flex flex-col gap-3">
      <h2 id="games-title" className="text-2xl font-bold">
        Juegos
      </h2>
      <Stagger>
        <ul className="grid gap-3 sm:grid-cols-2">
          {GAMES.map((game) => {
            const { id, Icon } = game;
            const chosen = id === selected;
            return (
              <StaggerItem
                as="li"
                key={id}
                aria-current={chosen ? 'true' : undefined}
                className={`relative flex gap-4 surface p-4 sm:flex-col sm:gap-3 ${
                  chosen ? 'bg-night-raised ring-2 ring-moon' : ''
                }`}
              >
                <span
                  className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${game.tone}`}
                >
                  <Icon className="size-9" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xl font-bold">{game.name}</h3>
                    {chosen && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-moon py-0.5 pr-3 pl-2 text-sm font-bold text-night sm:absolute sm:top-4 sm:right-4">
                        <CheckIcon className="size-4" />
                        Elegido
                      </span>
                    )}
                  </div>
                  <p className="text-base text-cream/75">{game.description}</p>
                  <button
                    type="button"
                    aria-label={`¿Cómo jugar ${game.name}?`}
                    onClick={() => {
                      onHowToPlay(id, game.name);
                    }}
                    className="relative z-10 -mx-3 -mb-2 inline-flex min-h-12 items-center self-start rounded-full px-3 text-base font-bold text-moon underline decoration-moon/40 underline-offset-4 transition-colors hover:bg-moon/10 hover:decoration-moon focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none sm:mt-auto"
                  >
                    ¿Cómo jugar?
                  </button>
                </div>
                {editable && (
                  <button
                    type="button"
                    aria-label={`Jugar ${game.name}`}
                    aria-pressed={chosen}
                    onClick={() => {
                      if (!chosen) onSelect(id);
                    }}
                    className="absolute inset-0 rounded-3xl focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
                  />
                )}
              </StaggerItem>
            );
          })}
        </ul>
      </Stagger>
    </section>
  );
}
