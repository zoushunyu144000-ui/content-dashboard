interface ScraperNoteProps {
  note: string | null | undefined;
}

export default function ScraperNote({ note }: ScraperNoteProps) {
  if (!note) return null;
  return (
    <p className="scraper-note" role="status">
      Scraper fallback: {note}
    </p>
  );
}
