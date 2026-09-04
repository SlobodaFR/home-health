import { DataSource } from 'typeorm';
import { HealthMetric } from '../../../domain/health-metric/health-metric';
import { HealthMetricOrmEntity } from '../entities/health-metric.orm-entity';
import { TypeOrmHealthMetricRepository } from './typeorm-health-metric.repository';

function metric(overrides: Partial<HealthMetric>): HealthMetric {
  return {
    userId: 'user-1',
    name: 'step_count',
    units: 'count',
    date: '2026-01-01',
    source: '',
    payload: { qty: 1 },
    ...overrides,
  };
}

describe('TypeOrmHealthMetricRepository', () => {
  let dataSource: DataSource;
  let repository: TypeOrmHealthMetricRepository;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [HealthMetricOrmEntity],
      synchronize: true,
    });
    await dataSource.initialize();
    repository = new TypeOrmHealthMetricRepository(dataSource);

    await repository.upsertMany([
      metric({ date: '2026-01-01', name: 'step_count' }),
      metric({ date: '2026-01-02', name: 'step_count' }),
      metric({ date: '2026-01-03', name: 'step_count' }),
      metric({ date: '2026-01-02', name: 'heart_rate' }),
      metric({ userId: 'user-2', date: '2026-01-02', name: 'step_count' }),
    ]);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('scopes results to the requesting user', async () => {
    const rows = await repository.list('user-2', {});
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe('user-2');
  });

  it('filters by name', async () => {
    const rows = await repository.list('user-1', { name: 'heart_rate' });
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('heart_rate');
  });

  it('filters by inclusive from/to date range', async () => {
    const rows = await repository.list('user-1', {
      name: 'step_count',
      from: '2026-01-01',
      to: '2026-01-02',
    });
    expect(rows.map((r) => r.date).sort()).toEqual([
      '2026-01-01',
      '2026-01-02',
    ]);
  });

  it('clamps the result count to `limit`', async () => {
    const rows = await repository.list('user-1', {
      name: 'step_count',
      limit: 1,
    });
    expect(rows).toHaveLength(1);
  });

  it("upserts a batch large enough to exceed SQLite's per-statement parameter limit", async () => {
    const bigBatch = Array.from({ length: 2000 }, (_, i) =>
      metric({
        userId: 'user-big-batch',
        name: 'heart_rate',
        date: `2026-02-${String((i % 28) + 1).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00`,
      }),
    );

    await expect(repository.upsertMany(bigBatch)).resolves.not.toThrow();

    const rows = await repository.list('user-big-batch', {
      name: 'heart_rate',
      limit: 1000,
    });
    expect(rows.length).toBeGreaterThan(0);
  });
});
