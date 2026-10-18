import { useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface SkipGuesserProps {
  guesser: string;
  skipping: boolean;
  onSkip: () => void;
}

export function SkipGuesser({ guesser, skipping, onSkip }: SkipGuesserProps) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        busy={skipping}
        onClick={() => {
          setConfirm(true);
        }}
      >
        Saltar turno
      </Button>
      {confirm && (
        <ConfirmDialog
          title={`${guesser} no está en línea. ¿Saltar su turno?`}
          confirmLabel="Sí, saltar"
          busy={skipping}
          onConfirm={() => {
            setConfirm(false);
            onSkip();
          }}
          onCancel={() => {
            setConfirm(false);
          }}
        />
      )}
    </>
  );
}
