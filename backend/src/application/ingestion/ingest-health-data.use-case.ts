import { Injectable } from '@nestjs/common';
import { HealthMetricRepository } from '../../domain/health-metric/health-metric.repository';
import { MINIMAL_HEALTH_RECORD_KINDS } from '../../domain/minimal-health-record/minimal-health-record';
import { MinimalHealthRecordRepository } from '../../domain/minimal-health-record/minimal-health-record.repository';
import { RawIngestionRepository } from '../../domain/raw-ingestion/raw-ingestion.repository';
import { WorkoutRepository } from '../../domain/workout/workout.repository';
import { JsonObject } from './json-object';
import { parseAutoExportMetrics } from './parse-auto-export-metrics';
import { parseAutoExportMinimalRecords } from './parse-auto-export-minimal-records';
import { parseAutoExportWorkouts } from './parse-auto-export-workouts';

export interface IngestHealthDataParams {
  userId: string;
  automationId: string | null;
  automationName: string | null;
  sessionId: string | null;
  /** The raw, unvalidated `data` object from the Auto Export payload. */
  data: JsonObject;
}

/**
 * Stores every top-level array present in `data` verbatim in raw_ingestions
 * (audit/rejouabilité), then normalizes the data types with a known shape
 * (metrics, workouts) into their typed tables, and the undocumented ones
 * into their minimal permissive tables. All writes are upserts, so repeated
 * or batched Auto Export runs stay idempotent.
 */
@Injectable()
export class IngestHealthDataUseCase {
  constructor(
    private readonly rawIngestionRepository: RawIngestionRepository,
    private readonly healthMetricRepository: HealthMetricRepository,
    private readonly workoutRepository: WorkoutRepository,
    private readonly minimalHealthRecordRepository: MinimalHealthRecordRepository,
  ) {}

  async execute(
    params: IngestHealthDataParams,
  ): Promise<{ dataTypes: string[] }> {
    const { userId, automationId, automationName, sessionId, data } = params;

    const dataTypes = Object.keys(data).filter((key) =>
      Array.isArray(data[key]),
    );
    for (const dataType of dataTypes) {
      await this.rawIngestionRepository.save({
        userId,
        automationId,
        automationName,
        sessionId,
        dataType,
        payload: data[dataType],
      });
    }

    if (Array.isArray(data.metrics)) {
      const metrics = parseAutoExportMetrics(userId, data.metrics);
      if (metrics.length > 0) {
        await this.healthMetricRepository.upsertMany(metrics);
      }
    }

    if (Array.isArray(data.workouts)) {
      const workouts = parseAutoExportWorkouts(userId, data.workouts);
      if (workouts.length > 0) {
        await this.workoutRepository.upsertMany(workouts);
      }
    }

    for (const kind of MINIMAL_HEALTH_RECORD_KINDS) {
      const rawItems = data[kind];
      if (Array.isArray(rawItems)) {
        const records = parseAutoExportMinimalRecords(userId, rawItems);
        if (records.length > 0) {
          await this.minimalHealthRecordRepository.upsertMany(kind, records);
        }
      }
    }

    return { dataTypes };
  }
}
