import { Injectable, NotFoundException } from '@nestjs/common';
import { Workout } from '../../domain/workout/workout';
import { WorkoutRepository } from '../../domain/workout/workout.repository';

@Injectable()
export class GetWorkoutUseCase {
  constructor(private readonly workoutRepository: WorkoutRepository) {}

  async execute(userId: string, id: string): Promise<Workout> {
    const workout = await this.workoutRepository.findById(userId, id);
    if (!workout) {
      throw new NotFoundException('Workout not found');
    }
    return workout;
  }
}
