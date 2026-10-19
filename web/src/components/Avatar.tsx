const TONES = [
  'bg-moon/18 text-moon',
  'bg-ember/18 text-ember',
  'bg-sage/18 text-sage',
  'bg-orchid/18 text-orchid',
  'bg-lagoon/18 text-lagoon',
  'bg-sand/18 text-sand',
];

function tone(playerId: string): string {
  let hash = 0;
  for (const char of playerId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length] ?? '';
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? [words[0], words.at(-1)] : [words[0]];
  return letters
    .map((word) => Array.from(word ?? '')[0] ?? '')
    .join('')
    .toUpperCase();
}

interface AvatarProps {
  playerId: string;
  name: string;
  dimmed?: boolean;
  className?: string;
}

export function Avatar({ playerId, name, dimmed = false, className = '' }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-bold ${tone(playerId)} ${dimmed ? 'opacity-45 grayscale' : ''} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
