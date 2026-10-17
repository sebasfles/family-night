import { createContext, use } from 'react';

export type ShowToast = (text: string) => void;

export const ToastContext = createContext<ShowToast | null>(null);

export function useToast(): ShowToast {
  const show = use(ToastContext);
  if (!show) throw new Error('useToast must be used inside ToastProvider');
  return show;
}
