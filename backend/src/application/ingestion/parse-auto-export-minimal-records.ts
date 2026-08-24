import { MinimalHealthRecord } from '../../domain/minimal-health-record/minimal-health-record';
import { isJsonObject } from './json-object';

/**
 * Format of these items is not publicly documented (DESIGN.md §12) - captured
 * as-is. `date` is best-effort (date/startDate/endDate, else empty string);
 * raw_ingestions keeps the untouched payload regardless, so nothing is lost
 * even when the date guess is wrong.
 */
export function parseAutoExportMinimalRecords(
  userId: string,
  rawItems: unknown[],
): MinimalHealthRecord[] {
  const records: MinimalHealthRecord[] = [];

  for (const item of rawItems) {
    if (!isJsonObject(item)) {
      continue;
    }
    const date =
      typeof item.date === 'string'
        ? item.date
        : typeof item.startDate === 'string'
          ? item.startDate
          : typeof item.endDate === 'string'
            ? item.endDate
            : '';
    records.push({ userId, date, payload: item });
  }

  return records;
}
