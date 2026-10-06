const WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 10;
const failures = new Map<string, number[]>();

function recent(ip: string): number[] {
  const now = Date.now();
  const kept = (failures.get(ip) || []).filter((at) => now - at < WINDOW_MS);
  failures.set(ip, kept);
  return kept;
}

export function loginBlocked(ip: string): boolean {
  return recent(ip).length >= MAX_FAILURES;
}

export function recordLoginFailure(ip: string): void {
  const kept = recent(ip);
  kept.push(Date.now());
  failures.set(ip, kept);
}

export function clientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}
