/**
 * Auto Export data types whose payload format is not publicly documented.
 * Each key here matches a table (see DESIGN.md §5 and §12) and the
 * corresponding key Auto Export uses under the top-level "data" object.
 */
export const MINIMAL_HEALTH_RECORD_KINDS = [
  'symptoms',
  'ecg',
  'heartRateNotifications',
  'stateOfMind',
  'cycleTracking',
  'medications',
] as const;

export type MinimalHealthRecordKind =
  (typeof MINIMAL_HEALTH_RECORD_KINDS)[number];

export interface MinimalHealthRecord {
  userId: string;
  date: string;
  payload: unknown;
}
