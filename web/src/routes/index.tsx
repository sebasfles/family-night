import { isRoomCode, ROOM_CODE_LENGTH } from '@family-night/shared';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type SubmitEvent } from 'react';
import { Button } from '../components/Button';
import { MoonIcon } from '../components/icons';
import { useCreateRoom } from '../components/useCreateRoom';
import { useIdentity } from '../identity/identity';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const identity = useIdentity();
  const navigate = useNavigate();
  const createRoom = useCreateRoom();
  const [code, setCode] = useState('');
  const valid = isRoomCode(code);

  const join = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (valid) void navigate({ to: '/$code', params: { code } });
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10 py-12">
      <header className="flex flex-col items-center gap-4 text-center">
        <MoonIcon className="size-16 text-moon" />
        <h1 className="text-4xl font-bold tracking-tight">Noche de juegos</h1>
        <p className="text-xl text-cream/90">
          Hola, <strong className="font-semibold text-moon">{identity.name}</strong>
        </p>
      </header>

      <Button
        busy={createRoom.isPending}
        onClick={() => {
          createRoom.mutate();
        }}
        className="w-full"
      >
        Crear sala
      </Button>

      <div className="flex items-center gap-3 text-base text-cream/60" aria-hidden="true">
        <span className="h-px flex-1 bg-cream/15" />o únete a una sala
        <span className="h-px flex-1 bg-cream/15" />
      </div>

      <form onSubmit={join} className="flex flex-col gap-3">
        <label htmlFor="room-code" className="text-base font-semibold text-cream/80">
          Código de sala
        </label>
        <div className="flex gap-3">
          <input
            id="room-code"
            value={code}
            onChange={(event) => {
              setCode(
                event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z]/g, '')
                  .slice(0, ROOM_CODE_LENGTH),
              );
            }}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="ABCD"
            className="min-h-12 w-0 flex-1 rounded-2xl bg-night-soft px-4 text-center text-2xl font-bold tracking-[0.3em] uppercase ring-1 ring-cream/15 placeholder:text-cream/25 focus:ring-2 focus:ring-moon focus:outline-none"
          />
          <Button type="submit" variant="secondary" disabled={!valid}>
            Unirme
          </Button>
        </div>
      </form>
    </main>
  );
}
