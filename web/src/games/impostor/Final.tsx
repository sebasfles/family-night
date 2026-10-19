import { impostorNightPoints, type ImpostorPublic, type RoomMember } from '@family-night/shared';
import type { ReactNode } from 'react';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { CrownIcon, MaskIcon } from '../../components/icons';
import { nameOf } from '../../components/match';
import { Scoreboard } from '../../components/Scoreboard';
import { FlipReveal } from '../../motion/Flip';
import { CardBack } from './Card';
import { reasonLabels } from './model';

interface FinalProps {
  match: ImpostorPublic;
  members: RoomMember[];
  selfId: string;
  isHost: boolean;
  rematching: boolean;
  leaving: boolean;
  onRematch: () => void;
  onLobby: () => void;
}

export function Final({
  match,
  members,
  selfId,
  isHost,
  rematching,
  leaving,
  onRematch,
  onLobby,
}: FinalProps) {
  const reveal = match.reveal;
  if (!reveal || !match.winner) return null;
  const civilians = match.winner === 'CIVILIANS';
  const points = impostorNightPoints(match);
  const present = (playerId: string) => members.some((member) => member.playerId === playerId);
  const rows = match.participants
    .filter(present)
    .map((playerId) => ({ playerId, from: 0, to: points[playerId] ?? 0 }));

  return (
    <section aria-labelledby="final-title" className="flex flex-col gap-6">
      <div
        className={`flex flex-col items-center gap-3 px-6 py-7 text-center ${
          civilians
            ? 'rounded-card bg-linear-to-b from-sage to-sage-deep text-night shadow-lift'
            : 'rounded-card card-wine'
        }`}
      >
        <span
          className={`flex size-16 items-center justify-center rounded-full ${
            civilians ? 'bg-night/10 text-night' : 'bg-ember text-night'
          }`}
        >
          {civilians ? <CrownIcon className="size-9" /> : <MaskIcon className="size-10" />}
        </span>
        <h2 id="final-title" className="text-4xl font-bold text-balance">
          {civilians ? 'Ganaron los civiles' : 'Ganaron los impostores'}
        </h2>
      </div>

      <FlipReveal
        back={
          <CardBack>
            <span className="mt-2 font-display text-2xl font-bold text-cream/80">
              La palabra era…
            </span>
          </CardBack>
        }
      >
        <div className="flex min-h-60 flex-col items-center justify-center gap-2 rounded-card p-7 text-center card-paper">
          <p className="font-sans text-sm font-bold tracking-[0.18em] text-night/65 uppercase">
            La palabra era
          </p>
          <p className="font-display text-5xl leading-tight font-bold break-words">{reveal.word}</p>
          <p className="rounded-full bg-night/8 px-3 py-1 text-base font-semibold text-night/75">
            Categoría: {reveal.category}
          </p>
        </div>
      </FlipReveal>

      <Block title={reveal.impostorIds.length === 1 ? 'El impostor' : 'Los impostores'}>
        <ul className="flex flex-wrap gap-2">
          {reveal.impostorIds.map((playerId) => (
            <li
              key={playerId}
              className="flex items-center gap-2 rounded-full bg-ember/14 py-1.5 pr-4 pl-1.5 text-base font-bold text-ember ring-1 ring-ember/35"
            >
              <Avatar
                playerId={playerId}
                name={nameOf(members, playerId)}
                className="size-8 text-xs"
              />
              {nameOf(members, playerId)}
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Eliminados por ronda">
        {match.eliminated.length === 0 ? (
          <p className="text-base text-cream/70">Nadie fue eliminado.</p>
        ) : (
          <ol className="flex flex-col gap-1.5 surface p-2">
            {match.eliminated.map((elimination) => (
              <li
                key={`${elimination.playerId}-${String(elimination.round)}`}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
              >
                <Avatar
                  playerId={elimination.playerId}
                  name={nameOf(members, elimination.playerId)}
                  className="size-10 text-sm"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold break-words">
                    <span className="text-cream/60">Ronda {elimination.round}:</span>{' '}
                    {nameOf(members, elimination.playerId)}
                  </span>
                  <span className="text-base text-cream/70">
                    {reasonLabels[elimination.reason]}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${
                    elimination.wasImpostor ? 'bg-ember/16 text-ember' : 'bg-sage/14 text-sage'
                  }`}
                >
                  {elimination.wasImpostor ? 'impostor' : 'civil'}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Block>

      <Scoreboard
        title="Puntos para la noche"
        rows={rows}
        members={members}
        selfId={selfId}
        signed
      />

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
    <div className="flex flex-col gap-3">
      <h3 className="text-xl font-bold">{title}</h3>
      {children}
    </div>
  );
}
