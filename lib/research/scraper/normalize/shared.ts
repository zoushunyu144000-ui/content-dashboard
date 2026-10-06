export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function canonicalUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    const cut = url.split('#')[0]?.split('?')[0];
    return cut || null;
  }
}

export function field(item: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = item;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      current = undefined;
      break;
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (current !== undefined) return current;
  if (Object.prototype.hasOwnProperty.call(item, path)) return item[path];
  return undefined;
}

export function isoFromSeconds(value: unknown): string | null {
  const seconds = asNumber(value);
  if (seconds == null) return null;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function isoFromUnknown(value: unknown): string | null {
  const text = asString(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
