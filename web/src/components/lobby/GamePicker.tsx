const GAMES = [
  {
    id: 'impostor',
    name: 'Impostor',
    description: 'Todos tienen la palabra, menos el impostor.',
    active: true,
  },
  {
    id: 'just-one',
    name: 'Just One',
    description: 'Pistas de una palabra para adivinar juntos.',
    active: false,
  },
  {
    id: 'wavelength',
    name: 'Wavelength',
    description: 'Lee la mente de tu familia en una escala.',
    active: false,
  },
];

export function GamePicker() {
  return (
    <section aria-labelledby="games-title" className="flex flex-col gap-3">
      <h2 id="games-title" className="text-xl font-bold">
        Juegos
      </h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {GAMES.map((game) => (
          <li
            key={game.id}
            aria-disabled={game.active ? undefined : 'true'}
            aria-current={game.active ? 'true' : undefined}
            className={`flex flex-col gap-2 rounded-3xl p-4 ${
              game.active
                ? 'bg-night-soft ring-2 ring-moon'
                : 'bg-night-soft/60 ring-1 ring-cream/10'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className={`text-lg font-bold ${game.active ? '' : 'text-cream/80'}`}>
                {game.name}
              </h3>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  game.active ? 'bg-moon text-night' : 'bg-cream/10 text-cream/70'
                }`}
              >
                {game.active ? 'Elegido' : 'Próximamente'}
              </span>
            </div>
            <p className={`text-base ${game.active ? 'text-cream/80' : 'text-cream/60'}`}>
              {game.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
