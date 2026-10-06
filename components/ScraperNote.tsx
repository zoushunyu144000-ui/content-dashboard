import { t } from '@/lib/i18n';

interface ScraperNoteProps {
  note: string | null | undefined;
}

export default function ScraperNote({ note }: ScraperNoteProps) {
  if (!note) return null;
  return (
    <p className="scraper-note" role="status">
      {t('scraper.fallback')}: {note}
    </p>
  );
}
