import { SignJWT, jwtVerify } from 'jose';

export interface SessionClaims {
  sub: string;
  email: string;
  role: 'admin' | 'member';
}

function secretKey(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  const key = secretKey();
  if (!key) throw new Error('SESSION_SECRET is not configured');
  return new SignJWT({ email: claims.email, role: claims.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function readSessionToken(token: string): Promise<SessionClaims | null> {
  const key = secretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    if (!payload.sub || typeof payload.email !== 'string') return null;
    if (payload.role !== 'admin' && payload.role !== 'member') return null;
    return { sub: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}
