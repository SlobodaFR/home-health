import { Injectable } from '@nestjs/common';
import { DateRangeQuery } from '../../domain/shared/date-range-query';
import { Workout } from '../../domain/workout/workout';
import { WorkoutRepository } from '../../domain/workout/workout.repository';

@Injectable()
export class ListWorkoutsUseCase {
  constructor(private readonly workoutRepository: WorkoutRepository) {}

  async execute(userId: string, query: DateRangeQuery): Promise<Workout[]> {
    return this.workoutRepository.list(userId, query);
  }
}
