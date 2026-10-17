import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { getHealth } from '../api/client';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 py-12 text-center">
      <svg aria-hidden="true" viewBox="0 0 64 64" className="size-20">
        <path
          d="M40 14a20 20 0 1 0 10 34A16 16 0 0 1 40 14z"
          fill="currentColor"
          className="text-moon"
        />
      </svg>
      <h1 className="text-4xl font-bold tracking-tight">Noche de juegos</h1>
      <p className="text-balance text-cream/80">
        Juegos para la familia, cada uno desde su celular.
      </p>
      <ServerStatus />
    </main>
  );
}

function ServerStatus() {
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, retry: false });

  const [dot, text] = health.isPending
    ? ['bg-cream/40', 'Conectando con el servidor…']
    : health.isError
      ? ['bg-red-400', 'El servidor no responde']
      : ['bg-emerald-400', `En línea, versión ${health.data.version}`];

  return (
    <p
      role="status"
      className="flex min-h-12 items-center gap-3 rounded-full bg-night-soft px-5 text-base text-cream/90"
    >
      <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${dot}`} />
      {text}
    </p>
  );
}
