import type { ImpostorSecret } from '@family-night/shared';
import { useState, type ReactNode } from 'react';
import { MaskIcon } from '../../components/icons';
import { vibrate } from '../../components/match';
import { Flip } from '../../motion/Flip';

const CARD = 'flex min-h-60 flex-col items-center justify-center gap-2 p-7 text-center';

export function Card({ secret }: { secret: ImpostorSecret | undefined }) {
  const [shown, setShown] = useState(false);

  if (!secret) {
    return (
      <div className={`${CARD} rounded-card card-back [--card-accent:var(--color-ember)]`}>
        <p role="status" className="text-lg font-semibold text-cream/75">
          Cargando tu carta…
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={shown}
      onClick={() => {
        if (!shown) vibrate();
        setShown(!shown);
      }}
      className="w-full rounded-card text-left focus-visible:ring-2 focus-visible:ring-moon focus-visible:ring-offset-4 focus-visible:ring-offset-night focus-visible:outline-none motion-safe:transition-transform motion-safe:active:scale-[0.98]"
    >
      <Flip
        flipped={shown}
        back={
          <CardBack>
            <CardBackHint />
          </CardBack>
        }
        front={<CardFace secret={secret} />}
      />
    </button>
  );
}

export function CardBack({ children }: { children?: ReactNode }) {
  return (
    <span className={`${CARD} rounded-card card-back [--card-accent:var(--color-ember)]`}>
      <span className="flex size-20 items-center justify-center rounded-full bg-night text-ember shadow-lift ring-1 ring-ember/40">
        <MaskIcon className="size-12" />
      </span>
      {children}
    </span>
  );
}

function CardBackHint() {
  return (
    <>
      <span className="mt-2 font-display text-2xl font-bold text-cream">
        Toca para ver tu carta
      </span>
      <span className="text-base text-cream/70">Que nadie más mire tu pantalla</span>
    </>
  );
}

export function CardFace({ secret }: { secret: ImpostorSecret }) {
  if (secret.role === 'CIVILIAN') {
    return (
      <span className={`${CARD} rounded-card card-paper`}>
        <span className="font-sans text-sm font-bold tracking-[0.18em] text-night/65 uppercase">
          Tu palabra
        </span>
        <span className="font-display text-5xl leading-tight font-bold break-words">
          {secret.word}
        </span>
        <span className="rounded-full bg-night/8 px-3 py-1 text-base font-semibold text-night/75">
          Categoría: {secret.category}
        </span>
        <span className="mt-2 text-sm text-night/65">Toca para ocultar</span>
      </span>
    );
  }
  return (
    <span className={`${CARD} rounded-card card-wine`}>
      <MaskIcon className="size-12 text-ember" />
      <span className="font-display text-3xl font-bold text-ember">Eres el impostor</span>
      <span className="text-xl text-cream/90">
        Pista: <strong className="font-display text-2xl text-cream">{secret.clue}</strong>
      </span>
      {secret.category && (
        <span className="rounded-full bg-cream/10 px-3 py-1 text-base font-semibold text-cream/80">
          Categoría: {secret.category}
        </span>
      )}
      <span className="mt-2 text-sm text-cream/60">Toca para ocultar</span>
    </span>
  );
}
