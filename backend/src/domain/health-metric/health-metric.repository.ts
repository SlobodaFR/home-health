import { HealthMetric } from './health-metric';

/** Port (driven side) implemented by the infrastructure layer. */
export abstract class HealthMetricRepository {
  /** Upserts on (userId, name, date, source) - idempotent across repeated/batched Auto Export runs. */
  abstract upsertMany(metrics: HealthMetric[]): Promise<void>;
}
