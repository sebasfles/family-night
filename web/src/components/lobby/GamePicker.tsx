import type { GameType } from '@family-night/shared';

interface Game {
  id: GameType | null;
  name: string;
  description: string;
}

const GAMES: Game[] = [
  { id: 'IMPOSTOR', name: 'Impostor', description: 'Todos tienen la palabra, menos el impostor.' },
  {
    id: 'WAVELENGTH',
    name: 'Wavelength',
    description: 'Lee la mente de tu familia en una escala.',
  },
  { id: null, name: 'Just One', description: 'Pistas de una palabra para adivinar juntos.' },
];

interface GamePickerProps {
  selected: GameType;
  editable: boolean;
  busy: boolean;
  onSelect: (game: GameType) => void;
}

export function GamePicker({ selected, editable, busy, onSelect }: GamePickerProps) {
  return (
    <section aria-labelledby="games-title" className="flex flex-col gap-3">
      <h2 id="games-title" className="text-xl font-bold">
        Juegos
      </h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {GAMES.map((game) => {
          const { id } = game;
          const playable = id !== null;
          const chosen = id === selected;
          return (
            <li
              key={game.name}
              aria-disabled={playable ? undefined : 'true'}
              aria-current={chosen ? 'true' : undefined}
              className={`relative flex flex-col gap-2 rounded-3xl p-4 ${
                chosen
                  ? 'bg-night-soft ring-2 ring-moon'
                  : playable
                    ? 'bg-night-soft ring-1 ring-cream/15'
                    : 'bg-night-soft/60 ring-1 ring-cream/10'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className={`text-lg font-bold ${playable ? '' : 'text-cream/80'}`}>
                  {game.name}
                </h3>
                {chosen && (
                  <span className="rounded-full bg-moon px-3 py-1 text-sm font-semibold text-night">
                    Elegido
                  </span>
                )}
                {!playable && (
                  <span className="rounded-full bg-cream/10 px-3 py-1 text-sm font-semibold text-cream/70">
                    Próximamente
                  </span>
                )}
              </div>
              <p className={`text-base ${playable ? 'text-cream/80' : 'text-cream/60'}`}>
                {game.description}
              </p>
              {editable && id && (
                <button
                  type="button"
                  aria-label={`Jugar ${game.name}`}
                  aria-pressed={chosen}
                  disabled={busy}
                  onClick={() => {
                    if (!chosen) onSelect(id);
                  }}
                  className="absolute inset-0 rounded-3xl focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none disabled:cursor-wait"
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
