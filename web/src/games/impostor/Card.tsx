import type { ImpostorSecret } from '@family-night/shared';
import { useState } from 'react';
import { vibrate } from '../../components/match';

export function Card({ secret }: { secret: ImpostorSecret | undefined }) {
  const [shown, setShown] = useState(false);

  if (!secret) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-3xl bg-night-soft p-6 text-cream/70 ring-1 ring-cream/10">
        Cargando tu carta…
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
      className={`flex min-h-48 w-full flex-col items-center justify-center gap-2 rounded-3xl p-6 text-center ring-1 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none ${
        shown ? 'bg-cream text-night ring-cream' : 'bg-night-soft ring-cream/15'
      }`}
    >
      {shown ? <Face secret={secret} /> : <Back />}
    </button>
  );
}

function Back() {
  return (
    <>
      <span className="text-2xl font-bold">Toca para ver tu carta</span>
      <span className="text-base text-cream/70">Que nadie más mire tu pantalla</span>
    </>
  );
}

function Face({ secret }: { secret: ImpostorSecret }) {
  if (secret.role === 'CIVILIAN') {
    return (
      <>
        <span className="text-base font-semibold text-night/60">Tu palabra</span>
        <span className="text-4xl font-bold break-words">{secret.word}</span>
        <span className="text-lg text-night/80">Categoría: {secret.category}</span>
        <span className="mt-2 text-sm text-night/60">Toca para ocultar</span>
      </>
    );
  }
  return (
    <>
      <span className="text-3xl font-bold text-red-700">Eres el impostor</span>
      <span className="text-xl">
        Pista: <strong>{secret.clue}</strong>
      </span>
      {secret.category && (
        <span className="text-lg text-night/80">Categoría: {secret.category}</span>
      )}
      <span className="mt-2 text-sm text-night/60">Toca para ocultar</span>
    </>
  );
}
