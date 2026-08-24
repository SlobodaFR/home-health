import { MinimalHealthRecord } from '../../../domain/minimal-health-record/minimal-health-record';

export interface MinimalHealthRecordDto {
  date: string;
  payload: unknown;
}

export function toMinimalHealthRecordDto(
  record: MinimalHealthRecord,
): MinimalHealthRecordDto {
  return { date: record.date, payload: record.payload };
}
