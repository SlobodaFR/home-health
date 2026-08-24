import { DateRangeQuery } from '../shared/date-range-query';
import { Workout } from './workout';

/** Port (driven side) implemented by the infrastructure layer. */
export abstract class WorkoutRepository {
  /** Upserts on `id` - idempotent across repeated/batched Auto Export runs. */
  abstract upsertMany(workouts: Workout[]): Promise<void>;
  /** `from`/`to` filter on `start`. */
  abstract list(userId: string, query: DateRangeQuery): Promise<Workout[]>;
  abstract findById(userId: string, id: string): Promise<Workout | null>;
}
