import { MoonIcon } from './icons';
import { Screen } from './Screen';

export function Loading({ text }: { text: string }) {
  return (
    <Screen>
      <MoonIcon className="size-14 text-moon/70 motion-safe:animate-pulse" />
      <p role="status" className="text-lg text-cream/80">
        {text}
      </p>
    </Screen>
  );
}
