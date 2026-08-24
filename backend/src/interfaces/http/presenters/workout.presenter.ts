import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Workout } from '../../../domain/workout/workout';

const FREE_FORM_JSON = {
  type: 'object' as const,
  additionalProperties: true,
  nullable: true,
};

export class WorkoutDto {
  @ApiProperty({
    example: 'wk-abc123',
    description:
      'Auto Export v2 workout id, or a deterministic id derived from (name, start) for v1 payloads.',
  })
  id!: string;

  @ApiProperty({ example: 'Running' })
  name!: string;

  @ApiProperty({ example: '2026-01-01T08:00:00Z' })
  start!: string;

  @ApiProperty({ example: '2026-01-01T08:30:00Z' })
  end!: string;

  @ApiProperty({ example: 1800, description: 'Duration in seconds.' })
  duration!: number;

  @ApiPropertyOptional({ nullable: true, example: null })
  location!: string | null;

  @ApiPropertyOptional({
    ...FREE_FORM_JSON,
    description: 'activeEnergyBurned, totalEnergy, intensity.',
  })
  energy!: unknown;

  @ApiPropertyOptional({
    ...FREE_FORM_JSON,
    description: 'distance, speed, avgSpeed, maxSpeed.',
  })
  distanceSpeed!: unknown;

  @ApiPropertyOptional({
    ...FREE_FORM_JSON,
    description: 'Elevation data, as reported by Auto Export.',
  })
  elevation!: unknown;

  @ApiPropertyOptional({
    ...FREE_FORM_JSON,
    description: 'heartRate, avgHeartRate, maxHeartRate.',
  })
  heartRate!: unknown;

  @ApiPropertyOptional({
    ...FREE_FORM_JSON,
    description: 'GPS route as an array of points, if recorded.',
  })
  route!: unknown;

  @ApiPropertyOptional({
    ...FREE_FORM_JSON,
    description:
      'Time-series fields: heartRateData, stepCount, cyclingPower, swim* fields.',
  })
  timeSeries!: unknown;

  @ApiPropertyOptional({
    ...FREE_FORM_JSON,
    description: 'Any other field Auto Export sent that is not listed above.',
  })
  metadata!: unknown;
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
