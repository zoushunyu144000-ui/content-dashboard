import { zh, type ZhKey } from './zh';

type Vars = Record<string, string | number>;

/** Look up a Simplified Chinese UI string. Falls back to the key if missing. */
export function t(key: ZhKey | string, vars?: Vars): string {
  const template = (zh as Record<string, string>)[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] == null ? '' : String(vars[name]),
  );
}

export { zh };
export type { ZhKey };
