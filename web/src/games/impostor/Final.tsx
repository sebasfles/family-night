import { matchScores, type ImpostorPublic, type RoomMember } from '@family-night/shared';
import type { ReactNode } from 'react';
import { Button } from '../../components/Button';
import { nameOf } from '../../components/match';
import { reasonLabels } from './model';

interface FinalProps {
  match: ImpostorPublic;
  members: RoomMember[];
  isHost: boolean;
  rematching: boolean;
  leaving: boolean;
  onRematch: () => void;
  onLobby: () => void;
}

export function Final({
  match,
  members,
  isHost,
  rematching,
  leaving,
  onRematch,
  onLobby,
}: FinalProps) {
  const reveal = match.reveal;
  if (!reveal || !match.winner) return null;
  const civilians = match.winner === 'CIVILIANS';
  const scores = Object.entries(matchScores(match, reveal.impostorIds)).filter(([playerId]) =>
    members.some((member) => member.playerId === playerId),
  );
  const guess = match.guess;

  return (
    <section aria-labelledby="final-title" className="flex flex-col gap-5">
      <div
        className={`flex flex-col items-center gap-1 rounded-3xl p-6 text-center ${
          civilians ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}
      >
        <h2 id="final-title" className="text-3xl font-bold text-balance">
          {civilians ? 'Ganaron los civiles' : 'Ganaron los impostores'}
        </h2>
        {guess?.correct && <p className="text-xl font-semibold">¡Robó la victoria!</p>}
        {guess?.chosen && !guess.correct && (
          <p className="text-lg">
            {nameOf(members, guess.guesserId)} dijo «{guess.chosen}» y falló
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-1 rounded-3xl bg-cream p-5 text-center text-night">
        <p className="text-base font-semibold text-night/60">La palabra era</p>
        <p className="text-4xl font-bold break-words">{reveal.word}</p>
        <p className="text-lg text-night/80">Categoría: {reveal.category}</p>
      </div>

      <Block title={reveal.impostorIds.length === 1 ? 'El impostor' : 'Los impostores'}>
        <ul className="flex flex-wrap gap-2">
          {reveal.impostorIds.map((playerId) => (
            <li
              key={playerId}
              className="rounded-full bg-red-600/20 px-4 py-2 text-base font-semibold text-red-200 ring-1 ring-red-400/40"
            >
              {nameOf(members, playerId)}
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Eliminados por ronda">
        {match.eliminated.length === 0 ? (
          <p className="text-base text-cream/70">Nadie fue eliminado.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-cream/10 rounded-2xl bg-night-soft ring-1 ring-cream/10">
            {match.eliminated.map((elimination) => (
              <li
                key={`${elimination.playerId}-${String(elimination.round)}`}
                className="flex flex-wrap items-baseline justify-between gap-x-3 px-4 py-3"
              >
                <span className="font-semibold">
                  <span className="text-cream/60">Ronda {elimination.round}:</span>{' '}
                  {nameOf(members, elimination.playerId)}
                </span>
                <span className="text-base text-cream/70">
                  {elimination.wasImpostor ? 'impostor' : 'civil'},{' '}
                  {reasonLabels[elimination.reason]}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Block>

      <Block title="Puntos de esta partida">
        <ul className="flex flex-col divide-y divide-cream/10 rounded-2xl bg-night-soft ring-1 ring-cream/10">
          {scores.map(([playerId, points]) => (
            <li key={playerId} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 break-words">{nameOf(members, playerId)}</span>
              <span className="shrink-0 font-bold text-moon tabular-nums">+{points}</span>
            </li>
          ))}
        </ul>
      </Block>

      {isHost ? (
        <div className="flex flex-col gap-3">
          <Button busy={rematching} disabled={leaving} onClick={onRematch}>
            Jugar otra vez
          </Button>
          <Button variant="ghost" busy={leaving} disabled={rematching} onClick={onLobby}>
            Volver al lobby
          </Button>
        </div>
      ) : (
        <p role="status" className="text-center text-lg text-cream/80">
          Esperando al host…
        </p>
      )}
    </section>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-lg font-bold">{title}</h3>
      {children}
    </div>
  );
}
