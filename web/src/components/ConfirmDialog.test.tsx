import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

test('focus stays where the player put it across parent renders, and Escape cancels with the latest handler', () => {
  const onCancel = vi.fn();
  const dialog = (render: number) => (
    <ConfirmDialog
      title="¿Cerrar la votación?"
      confirmLabel="Sí, cerrar"
      onConfirm={() => undefined}
      onCancel={() => {
        onCancel(render);
      }}
    />
  );
  const { rerender } = render(dialog(0));
  expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();

  const confirm = screen.getByRole('button', { name: 'Sí, cerrar' });
  confirm.focus();
  rerender(dialog(1));
  rerender(dialog(2));

  expect(confirm).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onCancel).toHaveBeenCalledWith(2);
});
