import { Workout } from '../../../domain/workout/workout';

export interface WorkoutDto {
  id: string;
  name: string;
  start: string;
  end: string;
  duration: number;
  location: string | null;
  energy: unknown;
  distanceSpeed: unknown;
  elevation: unknown;
  heartRate: unknown;
  route: unknown;
  timeSeries: unknown;
  metadata: unknown;
}

export function toWorkoutDto(workout: Workout): WorkoutDto {
  return {
    id: workout.id,
    name: workout.name,
    start: workout.start,
    end: workout.end,
    duration: workout.duration,
    location: workout.location,
    energy: workout.energy,
    distanceSpeed: workout.distanceSpeed,
    elevation: workout.elevation,
    heartRate: workout.heartRate,
    route: workout.route,
    timeSeries: workout.timeSeries,
    metadata: workout.metadata,
  };
}
