import { Injectable } from '@nestjs/common';
import { DataSource, EntityTarget, FindOptionsWhere } from 'typeorm';
import {
  MinimalHealthRecord,
  MinimalHealthRecordKind,
} from '../../../domain/minimal-health-record/minimal-health-record';
import { MinimalHealthRecordRepository } from '../../../domain/minimal-health-record/minimal-health-record.repository';
import { DateRangeQuery } from '../../../domain/shared/date-range-query';
import { deterministicId } from '../../../domain/shared/hash';
import { clampLimit, dateRangeWhere } from '../date-range-where';
import { CycleTrackingEntryOrmEntity } from '../entities/cycle-tracking-entry.orm-entity';
import { EcgReadingOrmEntity } from '../entities/ecg-reading.orm-entity';
import { HeartRateNotificationOrmEntity } from '../entities/heart-rate-notification.orm-entity';
import { MedicationEntryOrmEntity } from '../entities/medication-entry.orm-entity';
import { MinimalHealthRecordOrmEntity } from '../entities/minimal-health-record.orm-entity';
import { StateOfMindEntryOrmEntity } from '../entities/state-of-mind-entry.orm-entity';
import { SymptomOrmEntity } from '../entities/symptom.orm-entity';

const ENTITY_BY_KIND: Record<
  MinimalHealthRecordKind,
  EntityTarget<MinimalHealthRecordOrmEntity>
> = {
  symptoms: SymptomOrmEntity,
  ecg: EcgReadingOrmEntity,
  heartRateNotifications: HeartRateNotificationOrmEntity,
  stateOfMind: StateOfMindEntryOrmEntity,
  cycleTracking: CycleTrackingEntryOrmEntity,
  medications: MedicationEntryOrmEntity,
};

@Injectable()
export class TypeOrmMinimalHealthRecordRepository extends MinimalHealthRecordRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async upsertMany(
    kind: MinimalHealthRecordKind,
    records: MinimalHealthRecord[],
  ): Promise<void> {
    if (records.length === 0) {
      return;
    }
    const repository = this.dataSource.getRepository(ENTITY_BY_KIND[kind]);
    const rows = records.map((record) => ({
      // Content-derived id: repeated ingestion of the same item upserts the
      // same row instead of accumulating duplicates - the closest we can get
      // to a natural key when the payload shape isn't documented.
      id: deterministicId(
        kind,
        record.userId,
        record.date,
        JSON.stringify(record.payload),
      ),
      userId: record.userId,
      date: record.date,
      payload: record.payload,
    }));
    await repository.save(rows);
  }

  async list(
    kind: MinimalHealthRecordKind,
    userId: string,
    query: DateRangeQuery,
  ): Promise<MinimalHealthRecord[]> {
    const repository = this.dataSource.getRepository(ENTITY_BY_KIND[kind]);
    const where: FindOptionsWhere<MinimalHealthRecordOrmEntity> = { userId };
    const dateWhere = dateRangeWhere(query);
    if (dateWhere) {
      where.date = dateWhere;
    }
    const rows = await repository.find({
      where,
      order: { date: 'DESC' },
      take: clampLimit(query.limit),
    });
    return rows.map((row) => ({
      userId: row.userId,
      date: row.date,
      payload: row.payload as unknown,
    }));
  }
}
