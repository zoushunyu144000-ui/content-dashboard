import { sql as sql0001, version as version0001 } from './0001_init';

export interface Migration {
  version: string;
  sql: string;
}

export const migrations: Migration[] = [
  { version: version0001, sql: sql0001 },
];
