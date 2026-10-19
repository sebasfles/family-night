import { useNavigate } from '@tanstack/react-router';
import { Button } from './Button';
import { MoonIcon } from './icons';
import { Screen } from './Screen';
import { useCreateRoom } from './useCreateRoom';

export function RoomNotFound() {
  const navigate = useNavigate();
  const createRoom = useCreateRoom();
  return (
    <Screen>
      <MoonIcon className="size-16 text-cream/25" />
      <h1 className="text-3xl font-bold text-balance">Esta sala no existe o ya expiró</h1>
      <p className="text-cream/70">Las salas duran 24 horas sin actividad.</p>
      <div className="flex w-full flex-col gap-3">
        <Button
          busy={createRoom.isPending}
          onClick={() => {
            createRoom.mutate();
          }}
        >
          Crear una sala nueva
        </Button>
        <Button variant="ghost" onClick={() => void navigate({ to: '/' })}>
          Volver al inicio
        </Button>
      </div>
    </Screen>
  );
}
