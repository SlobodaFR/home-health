import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { HealthMetric } from '../../../domain/health-metric/health-metric';
import {
  HealthMetricRepository,
  ListHealthMetricsQuery,
} from '../../../domain/health-metric/health-metric.repository';
import { deterministicId } from '../../../domain/shared/hash';
import { clampLimit, dateRangeWhere } from '../date-range-where';
import { HealthMetricOrmEntity } from '../entities/health-metric.orm-entity';

@Injectable()
export class TypeOrmHealthMetricRepository extends HealthMetricRepository {
  constructor(
    @InjectRepository(HealthMetricOrmEntity)
    private readonly repository: Repository<HealthMetricOrmEntity>,
  ) {
    super();
  }

  async upsertMany(metrics: HealthMetric[]): Promise<void> {
    if (metrics.length === 0) {
      return;
    }
    const rows = metrics.map((metric) => ({
      // Content-derived, not random: the same (userId, name, date, source)
      // must always map to the same id, or upsert() would insert a fresh
      // row's id into an existing row on conflict and drift the primary key.
      id: deterministicId(
        'health_metric',
        metric.userId,
        metric.name,
        metric.date,
        metric.source,
      ),
      userId: metric.userId,
      name: metric.name,
      units: metric.units,
      date: metric.date,
      source: metric.source,
      // `unknown` -> `any`: arbitrary JSON crossing into the payload column.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      payload: metric.payload as any,
    }));
    await this.repository.upsert(rows, {
      conflictPaths: ['userId', 'name', 'date', 'source'],
    });
  }

  async list(
    userId: string,
    query: ListHealthMetricsQuery,
  ): Promise<HealthMetric[]> {
    const where: FindOptionsWhere<HealthMetricOrmEntity> = { userId };
    if (query.name) {
      where.name = query.name;
    }
    const dateWhere = dateRangeWhere(query);
    if (dateWhere) {
      where.date = dateWhere;
    }
    const rows = await this.repository.find({
      where,
      order: { date: 'DESC' },
      take: clampLimit(query.limit),
    });
    return rows.map(toDomain);
  }
}

function toDomain(row: HealthMetricOrmEntity): HealthMetric {
  return {
    userId: row.userId,
    name: row.name,
    units: row.units,
    date: row.date,
    source: row.source,
    payload: row.payload,
  };
}
