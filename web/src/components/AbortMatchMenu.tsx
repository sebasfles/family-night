import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import { Menu } from './Menu';

interface AbortMatchMenuProps {
  aborting: boolean;
  onAbort: () => void;
  title?: string;
}

export function AbortMatchMenu({
  aborting,
  onAbort,
  title = '¿Terminar la partida? Nadie suma puntos.',
}: AbortMatchMenuProps) {
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
          title={title}
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
