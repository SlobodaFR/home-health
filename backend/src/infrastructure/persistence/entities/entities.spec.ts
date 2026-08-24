import { DataSource } from 'typeorm';
import { HealthMetricOrmEntity } from './health-metric.orm-entity';
import { ormEntities } from './index';

describe('ormEntities', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: ormEntities,
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('creates a table for every entity', async () => {
    for (const entity of ormEntities) {
      const metadata = dataSource.getMetadata(entity);
      const rows: unknown[] = await dataSource.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [metadata.tableName],
      );
      expect(rows).toHaveLength(1);
    }
  });

  it('enforces the (user_id, name, date, source) unique index on health_metrics', async () => {
    const repository = dataSource.getRepository(HealthMetricOrmEntity);
    const row = {
      id: '1',
      userId: 'user-1',
      name: 'step_count',
      units: 'count',
      date: '2026-01-01T00:00:00Z',
      source: '',
      payload: { qty: 100 },
    };
    await repository.save(row);
    await expect(repository.save({ ...row, id: '2' })).rejects.toThrow();
  });
});
