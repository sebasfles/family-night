const GAMES = [
  { id: 'impostor', name: 'Impostor', description: 'Todos tienen la palabra, menos el impostor.' },
  { id: 'just-one', name: 'Just One', description: 'Pistas de una palabra para adivinar juntos.' },
  {
    id: 'wavelength',
    name: 'Wavelength',
    description: 'Lee la mente de tu familia en una escala.',
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
            aria-disabled="true"
            className="flex flex-col gap-2 rounded-3xl bg-night-soft/60 p-4 ring-1 ring-cream/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-cream/80">{game.name}</h3>
              <span className="rounded-full bg-cream/10 px-3 py-1 text-sm font-semibold text-cream/70">
                Próximamente
              </span>
            </div>
            <p className="text-base text-cream/60">{game.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
