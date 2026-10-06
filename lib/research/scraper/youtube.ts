import 'server-only';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ScraperUnavailableError } from './errors';
import { normalizeYouTubeFlatPlaylist } from './normalize/youtube';
import type { NormalizedVideo, ScrapeHandle, ScrapeStartInput, ScraperProvider } from './types';

const execFileAsync = promisify(execFile);

export class YouTubeShortsProvider implements ScraperProvider {
  id = 'youtube' as const;

  async start(input: ScrapeStartInput): Promise<ScrapeHandle> {
    const search = `https://www.youtube.com/results?search_query=${encodeURIComponent(input.keyword)}&sp=EgIYAQ%253D%253D`;
    try {
      const { stdout } = await execFileAsync(
        'yt-dlp',
        ['--flat-playlist', '-J', '--no-warnings', search],
        { timeout: 60_000, maxBuffer: 32 * 1024 * 1024 },
      );
      const payload = JSON.parse(stdout) as unknown;
      return {
        externalRunId: `yt-${Date.now()}`,
        datasetId: null,
        status: 'succeeded',
        rawMeta: { payload },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'yt-dlp failed';
      if (/ENOENT/.test(message)) throw new ScraperUnavailableError('yt-dlp is not installed');
      throw new ScraperUnavailableError(`YouTube search failed: ${message.slice(0, 300)}`);
    }
  }

  async poll(handle: ScrapeHandle): Promise<ScrapeHandle> {
    return { ...handle, status: handle.status === 'failed' ? 'failed' : 'succeeded' };
  }

  async fetchNormalized(handle: ScrapeHandle): Promise<NormalizedVideo[]> {
    return normalizeYouTubeFlatPlaylist(handle.rawMeta?.payload).slice(0, 20);
  }
}
