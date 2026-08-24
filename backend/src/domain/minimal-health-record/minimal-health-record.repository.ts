import { DateRangeQuery } from '../shared/date-range-query';
import {
  MinimalHealthRecord,
  MinimalHealthRecordKind,
} from './minimal-health-record';

/** Port (driven side) implemented by the infrastructure layer. */
export abstract class MinimalHealthRecordRepository {
  /** Upserts on a content-derived id (see deterministicId) - idempotent across repeated/batched Auto Export runs. */
  abstract upsertMany(
    kind: MinimalHealthRecordKind,
    records: MinimalHealthRecord[],
  ): Promise<void>;
  abstract list(
    kind: MinimalHealthRecordKind,
    userId: string,
    query: DateRangeQuery,
  ): Promise<MinimalHealthRecord[]>;
}
