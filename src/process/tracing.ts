/* eslint-disable @typescript-eslint/naming-convention */
export const ProcessSpanName = {
  MANAGER_PROCESS: 'process.manager.process',
  MANAGER_ENRICH_DATA: 'process.manager.enrich_data',
  MANAGER_FETCH_USER_DATA: 'process.manager.fetch_user_data',
} as const;

export type ProcessSpanName = (typeof ProcessSpanName)[keyof typeof ProcessSpanName];

export const ProcessAttributes = {
  SITE: 'process.site',
  LANGUAGE: 'process.query.language',
  SYSTEM: 'process.system',
  DURATION_MS: 'process.duration_ms',
  CHOSEN_RESULT_ID: 'process.chosen_result_id',
  USER_ID: 'process.user.id',
  RESULT_RANK: 'process.result.rank',
  RESULT_SCORE: 'process.result.score',
  RESULT_SOURCE: 'process.result.source',
  RESULT_LAYER: 'process.result.layer',
  RESULT_REGION: 'process.result.region',
} as const;

export type ProcessAttributes = (typeof ProcessAttributes)[keyof typeof ProcessAttributes];
