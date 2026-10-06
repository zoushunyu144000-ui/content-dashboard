export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { boot } = await import('@/lib/boot');
    await boot();
    if (process.env.RESEARCH_WORKER === '1') {
      const { startResearchWorker } = await import('@/lib/research/worker');
      startResearchWorker();
    }
  } catch (err) {
    console.error('[boot] failed', err);
  }
}
