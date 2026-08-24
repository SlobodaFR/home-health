import { Workout } from './workout';

/** Port (driven side) implemented by the infrastructure layer. */
export abstract class WorkoutRepository {
  /** Upserts on `id` - idempotent across repeated/batched Auto Export runs. */
  abstract upsertMany(workouts: Workout[]): Promise<void>;
}
