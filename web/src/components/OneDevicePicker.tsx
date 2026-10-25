import type { GameType } from '@family-night/shared';
import { Stagger, StaggerItem } from '../motion/motion';
import { Button } from './Button';
import { GAMES } from './games';
import { DeviceIcon } from './icons';

interface OneDevicePickerProps {
  available: readonly GameType[];
  onPick: (game: GameType) => void;
  onBack: () => void;
}

export function OneDevicePicker({ available, onPick, onBack }: OneDevicePickerProps) {
  return (
    <section aria-labelledby="one-device-title" className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-moon/14 text-moon">
          <DeviceIcon className="size-9" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 id="one-device-title" className="text-3xl font-bold">
            Un solo dispositivo
          </h1>
          <p className="text-lg text-cream/80">
            Sin sala: se pasan el dispositivo de mano en mano.
          </p>
        </div>
      </div>

      <Stagger>
        <ul aria-label="Juegos" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {GAMES.map(({ id, name, description, Icon, color, tint }) => {
            const playable = available.includes(id);
            return (
              <StaggerItem
                as="li"
                key={id}
                className={`relative flex gap-4 surface p-4 sm:flex-col sm:gap-3 ${
                  playable ? '' : 'opacity-60'
                }`}
              >
                <span
                  className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${
                    playable ? `${color} ${tint}` : 'bg-cream/6 text-cream/50'
                  }`}
                >
                  <Icon className="size-9" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <h2 className="text-xl font-bold">{name}</h2>
                  <p className="text-base text-cream/75">
                    {playable ? description : 'Todavía no se juega en un solo dispositivo.'}
                  </p>
                </div>
                {playable && (
                  <button
                    type="button"
                    aria-label={`Jugar ${name}`}
                    onClick={() => {
                      onPick(id);
                    }}
                    className="absolute inset-0 rounded-3xl transition-colors hover:bg-cream/4 focus-visible:ring-2 focus-visible:ring-moon focus-visible:outline-none"
                  />
                )}
              </StaggerItem>
            );
          })}
        </ul>
      </Stagger>

      <Button variant="ghost" onClick={onBack} className="sm:self-start">
        Volver al inicio
      </Button>
    </section>
  );
}
