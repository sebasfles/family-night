import { useState } from 'react';

const KEY = 'family-night.dial-sound';

let context: AudioContext | null = null;

export function unlockTick(): void {
  if (!('AudioContext' in window)) return;
  context ??= new AudioContext();
  if (context.state === 'suspended') context.resume().catch(() => undefined);
}

export function playTick(): void {
  if (context?.state !== 'running') return;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(1800, now);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.03);
}

function readSound(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function useDialSound() {
  const [sound, setSound] = useState(readSound);
  const toggle = () => {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem(KEY, next ? 'on' : 'off');
    } catch {
      return;
    }
  };
  return [sound, toggle] as const;
}
