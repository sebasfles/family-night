import type { GameType } from '@family-night/shared';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { OneDevicePicker } from '../../components/OneDevicePicker';
import { loadOneDeviceMatch } from '../../games/wavelength/oneDevice';

const oneDevicePaths = {
  WAVELENGTH: '/un-dispositivo/wavelength',
} as const satisfies Partial<Record<GameType, string>>;

const available = Object.keys(oneDevicePaths) as (keyof typeof oneDevicePaths)[];

function isOneDeviceGame(game: GameType): game is keyof typeof oneDevicePaths {
  return game in oneDevicePaths;
}

export const Route = createFileRoute('/un-dispositivo/')({
  beforeLoad: () => {
    if (loadOneDeviceMatch()) {
      redirect({ to: '/un-dispositivo/wavelength', replace: true, throw: true });
    }
  },
  component: OneDeviceRoute,
});

function OneDeviceRoute() {
  const navigate = useNavigate();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-6 sm:max-w-2xl lg:max-w-5xl">
      <OneDevicePicker
        available={available}
        onPick={(game) => {
          if (isOneDeviceGame(game)) void navigate({ to: oneDevicePaths[game] });
        }}
        onBack={() => void navigate({ to: '/' })}
      />
    </main>
  );
}
