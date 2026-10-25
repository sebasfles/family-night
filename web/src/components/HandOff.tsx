import { Avatar } from './Avatar';
import { Button } from './Button';
import { useEnterKey } from './keys';

interface HandOffProps {
  playerId: string;
  name: string;
  title: string;
  hint: string;
  action: string;
  onReady: () => void;
}

export function HandOff({ playerId, name, title, hint, action, onReady }: HandOffProps) {
  useEnterKey(onReady);
  return (
    <section
      aria-labelledby="hand-off-title"
      className="flex w-full max-w-lg flex-col items-center gap-6 self-center surface px-6 py-8 text-center md:gap-8 md:px-10 md:py-12"
    >
      <Avatar playerId={playerId} name={name} className="size-24 text-3xl md:size-28 md:text-4xl" />
      <div className="flex flex-col gap-2">
        <h2 id="hand-off-title" className="text-3xl font-bold text-balance break-words md:text-4xl">
          {title}
        </h2>
        <p className="text-lg text-balance text-cream/80">{hint}</p>
      </div>
      <Button className="w-full" onClick={onReady}>
        {action}
      </Button>
    </section>
  );
}
