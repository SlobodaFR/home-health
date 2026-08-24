import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workout } from '../../../domain/workout/workout';
import { WorkoutRepository } from '../../../domain/workout/workout.repository';
import { WorkoutOrmEntity } from '../entities/workout.orm-entity';

@Injectable()
export class TypeOrmWorkoutRepository extends WorkoutRepository {
  constructor(
    @InjectRepository(WorkoutOrmEntity)
    private readonly repository: Repository<WorkoutOrmEntity>,
  ) {
    super();
  }

  async upsertMany(workouts: Workout[]): Promise<void> {
    if (workouts.length === 0) {
      return;
    }
    // save() upserts on the primary key (id) - already the natural key here.
    await this.repository.save(workouts);
  }
}
