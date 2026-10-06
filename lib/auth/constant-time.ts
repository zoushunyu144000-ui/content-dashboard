import { createHash, timingSafeEqual } from 'crypto';

export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const token = header?.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const actual = createHash('sha256').update(token).digest();
  const expected = createHash('sha256').update(secret).digest();
  return timingSafeEqual(actual, expected);
}
