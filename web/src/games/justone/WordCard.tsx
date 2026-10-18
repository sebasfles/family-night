export function WordCard({ word }: { word: string | undefined }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-3xl bg-cream p-5 text-center text-night">
      <h2 id="word-title" className="text-base font-semibold text-night/60">
        La palabra secreta
      </h2>
      <p className="text-4xl font-bold break-words">{word ?? '…'}</p>
    </div>
  );
}
