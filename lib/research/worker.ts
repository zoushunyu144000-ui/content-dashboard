const globalForWorker = globalThis as unknown as { __researchWorkerStarted?: boolean };

let inFlight = false;

export function startResearchWorker(): void {
  if (globalForWorker.__researchWorkerStarted) return;
  globalForWorker.__researchWorkerStarted = true;

  const intervalMs = Math.max(1000, Number(process.env.RESEARCH_TICK_MS || 5000) || 5000);
  const port = process.env.PORT || '3100';

  setInterval(() => {
    if (inFlight) return;
    const secret = process.env.WORKER_SECRET?.trim();
    if (!secret) {
      console.error('[research-worker] WORKER_SECRET is not set');
      return;
    }
    inFlight = true;
    fetch(`http://127.0.0.1:${port}/api/internal/research-tick`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
      .then((res) => {
        if (!res.ok) console.error('[research-worker] tick failed', res.status);
      })
      .catch((err) => {
        console.error('[research-worker] tick error', err);
      })
      .finally(() => {
        inFlight = false;
      });
  }, intervalMs);
}
