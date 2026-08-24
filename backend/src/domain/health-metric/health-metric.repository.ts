import { DateRangeQuery } from '../shared/date-range-query';
import { HealthMetric } from './health-metric';

export interface ListHealthMetricsQuery extends DateRangeQuery {
  name?: string;
}

/** Port (driven side) implemented by the infrastructure layer. */
export abstract class HealthMetricRepository {
  /** Upserts on (userId, name, date, source) - idempotent across repeated/batched Auto Export runs. */
  abstract upsertMany(metrics: HealthMetric[]): Promise<void>;
  abstract list(
    userId: string,
    query: ListHealthMetricsQuery,
  ): Promise<HealthMetric[]>;
}
