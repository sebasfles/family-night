import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { Menu } from './Menu';

export function AbortMatchMenu({ aborting, onAbort }: { aborting: boolean; onAbort: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Menu
        label="Opciones de la partida"
        items={[
          {
            label: 'Terminar partida',
            danger: true,
            onSelect: () => {
              setConfirm(true);
            },
          },
        ]}
      />
      {confirm && (
        <ConfirmDialog
          title="¿Terminar la partida? Nadie suma puntos."
          confirmLabel="Sí, terminar"
          busy={aborting}
          onConfirm={onAbort}
          onCancel={() => {
            setConfirm(false);
          }}
        />
      )}
    </>
  );
}
