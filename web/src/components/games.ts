import type { GameType } from '@family-night/shared';
import type { ComponentType } from 'react';
import { CluesIcon, CowIcon, DialIcon, MaskIcon } from './icons';

export interface Game {
  id: GameType;
  name: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  color: string;
  tint: string;
}

export const GAMES: Game[] = [
  {
    id: 'IMPOSTOR',
    name: 'Impostor',
    description: 'Todos tienen la palabra, menos el impostor.',
    Icon: MaskIcon,
    color: 'text-ember',
    tint: 'bg-ember/14',
  },
  {
    id: 'WAVELENGTH',
    name: 'Wavelength',
    description: 'Lee la mente de tu familia en una escala.',
    Icon: DialIcon,
    color: 'text-moon',
    tint: 'bg-moon/14',
  },
  {
    id: 'JUST_ONE',
    name: 'Just One',
    description: 'Pistas de una palabra para adivinar juntos.',
    Icon: CluesIcon,
    color: 'text-orchid',
    tint: 'bg-orchid/14',
  },
  {
    id: 'MANADA',
    name: 'La manada',
    description: 'Responde lo mismo que la mayoría.',
    Icon: CowIcon,
    color: 'text-rose',
    tint: 'bg-rose/14',
  },
];
