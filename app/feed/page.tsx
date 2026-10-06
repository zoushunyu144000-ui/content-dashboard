export const dynamic = 'force-dynamic';

export default function FeedPage() {
  return (
    <div className="space-y-3 animate-fade-in">
      <h1 className="font-heading text-[2rem] tracking-wide">Feed</h1>
      <p className="text-sm text-muted max-w-xl">
        Videos from a finished research run, with viral score and the AI read of each one.
      </p>
    </div>
  );
}
