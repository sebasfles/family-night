import { isRoomCode, ROOM_CODE_LENGTH } from '@family-night/shared';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type SubmitEvent } from 'react';
import { Button } from '../components/Button';
import { CluesIcon, DialIcon, MaskIcon, MoonIcon } from '../components/icons';
import { useCreateRoom } from '../components/useCreateRoom';
import { useIdentity } from '../identity/identity';
import { Enter, Stagger, StaggerItem } from '../motion/motion';

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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 py-12">
      <Stagger className="flex flex-col items-center gap-5 text-center">
        <StaggerItem className="relative">
          <span
            aria-hidden="true"
            className="absolute inset-0 scale-150 rounded-full bg-moon/25 blur-2xl"
          />
          <MoonIcon className="relative size-20 text-moon motion-safe:animate-float" />
        </StaggerItem>
        <StaggerItem>
          <h1 className="text-5xl leading-[1.05] font-bold text-balance sm:text-6xl">
            Noche de juegos
          </h1>
        </StaggerItem>
        <StaggerItem>
          <p className="text-xl text-cream/85">
            Hola, <strong className="font-bold text-moon">{identity.name}</strong>
          </p>
        </StaggerItem>
      </Stagger>

      <Enter delay={0.18} className="flex flex-col gap-6 surface p-6">
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
          <span className="h-px flex-1 bg-cream/12" />o únete a una sala
          <span className="h-px flex-1 bg-cream/12" />
        </div>

        <form onSubmit={join} className="flex flex-col gap-3">
          <label htmlFor="room-code" className="text-base font-bold text-cream/80">
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
              className="min-h-14 w-0 flex-1 rounded-2xl bg-night pr-4 pl-[calc(1rem+0.25em)] text-center font-display text-2xl font-bold tracking-[0.25em] text-moon uppercase ring-1 ring-cream/12 placeholder:text-cream/50 focus:ring-2 focus:ring-moon focus:outline-none"
            />
            <Button type="submit" variant="secondary" disabled={!valid} className="min-h-14 px-5">
              Unirme
            </Button>
          </div>
        </form>
      </Enter>

      <Enter delay={0.3}>
        <ul
          aria-label="Juegos"
          className="flex flex-wrap justify-center gap-2 text-base font-semibold text-cream/70"
        >
          <li className="flex items-center gap-2 rounded-full bg-cream/6 py-1.5 pr-4 pl-2">
            <MaskIcon className="size-6 text-ember" />
            Impostor
          </li>
          <li className="flex items-center gap-2 rounded-full bg-cream/6 py-1.5 pr-4 pl-2">
            <DialIcon className="size-6 text-moon" />
            Wavelength
          </li>
          <li className="flex items-center gap-2 rounded-full bg-cream/6 py-1.5 pr-4 pl-2">
            <CluesIcon className="size-6 text-orchid" />
            Just One
          </li>
        </ul>
      </Enter>
    </main>
  );
}
