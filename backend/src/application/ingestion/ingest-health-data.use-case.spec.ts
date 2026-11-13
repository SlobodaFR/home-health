import { HealthMetric } from '../../domain/health-metric/health-metric';
import { HealthMetricRepository } from '../../domain/health-metric/health-metric.repository';
import {
  MinimalHealthRecord,
  MinimalHealthRecordKind,
} from '../../domain/minimal-health-record/minimal-health-record';
import { MinimalHealthRecordRepository } from '../../domain/minimal-health-record/minimal-health-record.repository';
import { RawIngestion } from '../../domain/raw-ingestion/raw-ingestion';
import { RawIngestionRepository } from '../../domain/raw-ingestion/raw-ingestion.repository';
import { UnitOfWork } from '../../domain/shared/unit-of-work';
import { Workout } from '../../domain/workout/workout';
import { WorkoutRepository } from '../../domain/workout/workout.repository';
import { IngestHealthDataUseCase } from './ingest-health-data.use-case';

describe('IngestHealthDataUseCase', () => {
  let rawIngestions: RawIngestion[];
  let metrics: HealthMetric[];
  let workouts: Workout[];
  let minimalRecords: {
    kind: MinimalHealthRecordKind;
    records: MinimalHealthRecord[];
  }[];
  let useCase: IngestHealthDataUseCase;

  beforeEach(() => {
    rawIngestions = [];
    metrics = [];
    workouts = [];
    minimalRecords = [];

    const rawIngestionRepository: RawIngestionRepository = {
      save: (entry) => {
        rawIngestions.push(entry);
        return Promise.resolve();
      },
    };
    const healthMetricRepository: HealthMetricRepository = {
      upsertMany: (rows) => {
        metrics.push(...rows);
        return Promise.resolve();
      },
      list: () => Promise.resolve([]),
    };
    const workoutRepository: WorkoutRepository = {
      upsertMany: (rows) => {
        workouts.push(...rows);
        return Promise.resolve();
      },
      list: () => Promise.resolve([]),
      findById: () => Promise.resolve(null),
    };
    const minimalHealthRecordRepository: MinimalHealthRecordRepository = {
      upsertMany: (kind, records) => {
        minimalRecords.push({ kind, records });
        return Promise.resolve();
      },
      list: () => Promise.resolve([]),
    };
    const unitOfWork: UnitOfWork = { run: (work) => work() };

    useCase = new IngestHealthDataUseCase(
      rawIngestionRepository,
      healthMetricRepository,
      workoutRepository,
      minimalHealthRecordRepository,
      unitOfWork,
    );
  });

  it('saves one raw_ingestion row per top-level array key and normalizes known types', async () => {
    const { dataTypes } = await useCase.execute({
      userId: 'user-1',
      automationId: 'auto-1',
      automationName: 'Sync',
      sessionId: 'session-1',
      data: {
        metrics: [
          {
            name: 'step_count',
            units: 'count',
            data: [{ date: '2026-01-01', qty: 100 }],
          },
        ],
        workouts: [
          {
            id: 'wk-1',
            name: 'Running',
            start: '2026-01-01T08:00:00Z',
            end: '2026-01-01T08:30:00Z',
            duration: 1800,
          },
        ],
        symptoms: [{ date: '2026-01-01', value: 'headache' }],
      },
    });

    expect(dataTypes.toSorted()).toEqual(['metrics', 'symptoms', 'workouts']);
    expect(rawIngestions).toHaveLength(3);
    expect(rawIngestions[0]).toMatchObject({
      userId: 'user-1',
      automationId: 'auto-1',
      dataType: 'metrics',
    });

    expect(metrics).toHaveLength(1);
    expect(workouts).toHaveLength(1);
    expect(minimalRecords).toEqual([
      {
        kind: 'symptoms',
        records: [
          {
            userId: 'user-1',
            date: '2026-01-01',
            payload: { date: '2026-01-01', value: 'headache' },
          },
        ],
      },
    ]);
  });

  it('ignores non-array top-level keys and keys with no recognized data', async () => {
    const { dataTypes } = await useCase.execute({
      userId: 'user-1',
      automationId: null,
      automationName: null,
      sessionId: null,
      data: { notAnArray: { foo: 'bar' } },
    });

    expect(dataTypes).toEqual([]);
    expect(rawIngestions).toHaveLength(0);
  });
});
