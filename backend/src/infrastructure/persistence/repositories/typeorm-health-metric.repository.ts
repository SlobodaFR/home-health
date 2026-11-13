import { Injectable } from '@nestjs/common';
import { DataSource, FindOptionsWhere } from 'typeorm';
import { HealthMetric } from '../../../domain/health-metric/health-metric';
import {
  HealthMetricRepository,
  ListHealthMetricsQuery,
} from '../../../domain/health-metric/health-metric.repository';
import { chunk } from '../../../domain/shared/chunk';
import { deterministicId } from '../../../domain/shared/hash';
import { clampLimit, dateRangeWhere } from '../date-range-where';
import { HealthMetricOrmEntity } from '../entities/health-metric.orm-entity';
import { currentManager } from '../typeorm-unit-of-work';

// 7 columns per row; keeps every batch well under SQLite's parameter limit.
const UPSERT_CHUNK_SIZE = 100;

@Injectable()
export class TypeOrmHealthMetricRepository extends HealthMetricRepository {
  constructor(private readonly dataSource: DataSource) {
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
      // oxlint-disable-next-line typescript/no-unsafe-assignment
      payload: metric.payload as any,
    }));
    const manager = currentManager(this.dataSource);
    for (const batch of chunk(rows, UPSERT_CHUNK_SIZE)) {
      await manager.upsert(HealthMetricOrmEntity, batch, {
        conflictPaths: ['userId', 'name', 'date', 'source'],
      });
    }
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
    const rows = await currentManager(this.dataSource).find(
      HealthMetricOrmEntity,
      {
        where,
        order: { date: 'DESC' },
        take: clampLimit(query.limit),
      },
    );
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
