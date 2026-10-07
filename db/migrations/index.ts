import { sql as sql0001, version as version0001 } from './0001_init';
import { sql as sql0002, version as version0002 } from './0002_video_analysis_relevance';
import { sql as sql0003, version as version0003 } from './0003_v02';
import { sql as sql0004, version as version0004 } from './0004_audience';
import { sql as sql0005, version as version0005 } from './0005_reports';
import { sql as sql0006, version as version0006 } from './0006_comments';

export interface Migration {
  version: string;
  sql: string;
}

export const migrations: Migration[] = [
  { version: version0001, sql: sql0001 },
  { version: version0002, sql: sql0002 },
  { version: version0003, sql: sql0003 },
  { version: version0004, sql: sql0004 },
  { version: version0005, sql: sql0005 },
  { version: version0006, sql: sql0006 },
];
