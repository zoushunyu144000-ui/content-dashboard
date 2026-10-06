import 'server-only';
import { spawn } from 'child_process';
import { getServerEnv } from '@/lib/env.server';
import { ScraperUnavailableError } from './errors';
import { normalizeYouTubeFlatPlaylist } from './normalize/youtube';
import type { NormalizedVideo, ScrapeHandle, ScrapeStartInput, ScraperProvider } from './types';

const YT_DLP_TIMEOUT_MS = 20_000;
const YT_DLP_MAX_BUFFER = 32 * 1024 * 1024;

export class YouTubeShortsProvider implements ScraperProvider {
  id = 'youtube' as const;

  async start(input: ScrapeStartInput): Promise<ScrapeHandle> {
    if (!getServerEnv().youtubeProviderEnabled) {
      throw new ScraperUnavailableError('YouTube Shorts is unavailable on this server');
    }
    const search = `https://www.youtube.com/results?search_query=${encodeURIComponent(input.keyword)}&sp=EgIYAQ%253D%253D`;
    try {
      const stdout = await runYtDlp(['--flat-playlist', '-J', '--no-warnings', search]);
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

/** Runs yt-dlp in its own process group and always settles, even if the child is killed. */
function runYtDlp(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    const child = spawn('yt-dlp', args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => {
      killChild();
      finish(new Error('yt-dlp timed out'));
    }, YT_DLP_TIMEOUT_MS);

    function killChild(): void {
      if (child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          try { child.kill('SIGKILL'); } catch { /* already gone */ }
        }
      }
      child.stdout?.destroy();
      child.stderr?.destroy();
      child.unref();
    }

    function finish(err: Error | null, output?: string): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(output || '');
    }

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
      if (stdout.length > YT_DLP_MAX_BUFFER) {
        killChild();
        finish(new Error('yt-dlp output exceeded 32MB'));
      }
    });
    child.stderr?.on('data', (chunk: string) => {
      if (stderr.length < 2000) stderr += chunk;
    });
    child.on('error', (err) => {
      killChild();
      finish(err);
    });
    child.on('close', (code) => {
      if (code === 0) finish(null, stdout);
      else finish(new Error(stderr.trim().slice(0, 300) || `yt-dlp exited ${code}`));
    });
  });
}
