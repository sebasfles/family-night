import { outcome, type ImpostorPublic, type RoomMember } from '@family-night/shared';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';

interface RevealProps {
  match: ImpostorPublic;
  members: RoomMember[];
  isHost: boolean;
  busy: boolean;
  onNext: () => void;
}

const nextLabels = {
  CONTINUE: 'Siguiente ronda',
  CIVILIANS: 'Ver resultado',
  IMPOSTORS: 'Ver resultado',
} as const;

export function Reveal({ match, members, isHost, busy, onNext }: RevealProps) {
  const result = match.lastResult;
  if (!result) return null;
  const out = match.eliminated.find(
    (elimination) =>
      elimination.round === result.round && elimination.playerId === result.eliminatedId,
  );
  const top = result.tally[0]?.votes ?? 0;
  const headline = result.tie
    ? out
      ? 'Empate: eliminado por sorteo'
      : 'Empate: nadie es eliminado'
    : out
      ? `${nameOf(members, out.playerId)} fue eliminado`
      : 'Nadie votó: nadie es eliminado';

  return (
    <section aria-labelledby="reveal-title" className="flex flex-col gap-4">
      <h2 id="reveal-title" className="text-center text-2xl font-bold text-balance">
        {headline}
      </h2>

      {out && (
        <div
          role="status"
          className={`flex flex-col items-center gap-1 rounded-3xl p-5 text-center ${
            out.wasImpostor ? 'bg-red-600 text-white' : 'bg-cream/15 text-cream'
          }`}
        >
          <p className="text-2xl font-bold">
            {result.tie
              ? `${nameOf(members, out.playerId)} ${out.wasImpostor ? 'era' : 'no era'} impostor`
              : out.wasImpostor
                ? 'Era impostor'
                : 'No era impostor'}
          </p>
        </div>
      )}

      <ol aria-label="Votos" className="flex flex-col gap-2">
        {result.tally.map((entry) => {
          const eliminated = entry.playerId === result.eliminatedId;
          return (
            <li
              key={entry.playerId}
              className={`flex flex-col gap-2 rounded-2xl px-4 py-3 ${
                eliminated
                  ? 'bg-night-soft ring-2 ring-moon'
                  : 'bg-night-soft/60 ring-1 ring-cream/10'
              }`}
            >
              <div className="flex items-center justify-between gap-3 text-lg">
                <span className={`min-w-0 break-words ${eliminated ? 'font-bold' : ''}`}>
                  {nameOf(members, entry.playerId)}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {entry.votes} {entry.votes === 1 ? 'voto' : 'votos'}
                </span>
              </div>
              <span aria-hidden="true" className="h-2 rounded-full bg-cream/10">
                <span
                  className={`block h-2 rounded-full ${eliminated ? 'bg-moon' : 'bg-cream/40'}`}
                  style={{ width: top ? `${String((entry.votes / top) * 100)}%` : '0%' }}
                />
              </span>
            </li>
          );
        })}
      </ol>

      {isHost ? (
        <Button busy={busy} onClick={onNext}>
          {nextLabels[outcome(match)]}
        </Button>
      ) : (
        <p role="status" className="text-center text-lg text-cream/80">
          Esperando al host…
        </p>
      )}
    </section>
  );
}
