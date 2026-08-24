import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { DateRangeQuery } from '../../../domain/shared/date-range-query';
import { Workout } from '../../../domain/workout/workout';
import { WorkoutRepository } from '../../../domain/workout/workout.repository';
import { clampLimit, dateRangeWhere } from '../date-range-where';
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

  async list(userId: string, query: DateRangeQuery): Promise<Workout[]> {
    const where: FindOptionsWhere<WorkoutOrmEntity> = { userId };
    const dateWhere = dateRangeWhere(query);
    if (dateWhere) {
      where.start = dateWhere;
    }
    const rows = await this.repository.find({
      where,
      order: { start: 'DESC' },
      take: clampLimit(query.limit),
    });
    return rows.map(toDomain);
  }

  async findById(userId: string, id: string): Promise<Workout | null> {
    const row = await this.repository.findOne({ where: { id, userId } });
    return row ? toDomain(row) : null;
  }
}

function toDomain(row: WorkoutOrmEntity): Workout {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    start: row.start,
    end: row.end,
    duration: row.duration,
    location: row.location,
    energy: row.energy,
    distanceSpeed: row.distanceSpeed,
    elevation: row.elevation,
    heartRate: row.heartRate,
    route: row.route,
    timeSeries: row.timeSeries,
    metadata: row.metadata,
  };
}
