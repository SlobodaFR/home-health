import { DataSource } from 'typeorm';
import { ApiKey } from '../../../domain/api-key/api-key';
import { ApiKeyOrmEntity } from '../entities/api-key.orm-entity';
import { RevokedSessionOrmEntity } from '../entities/revoked-session.orm-entity';
import { SymptomOrmEntity } from '../entities/symptom.orm-entity';
import { serializeConnection } from '../serialized-connection';
import { TypeOrmUnitOfWork } from '../typeorm-unit-of-work';
import { TypeOrmApiKeyRepository } from './typeorm-api-key.repository';
import { TypeOrmMinimalHealthRecordRepository } from './typeorm-minimal-health-record.repository';
import { TypeOrmRevokedSessionRepository } from './typeorm-revoked-session.repository';

// Short gate wait: before the fix, a read outside the transaction's manager waits for the
// gate and rejects after this delay instead of seeing the transaction's rows.
const MAX_WAIT_MS = 300;

describe('repositories read through the unit-of-work manager', () => {
  let dataSource: DataSource;
  let unitOfWork: TypeOrmUnitOfWork;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [SymptomOrmEntity, ApiKeyOrmEntity, RevokedSessionOrmEntity],
      synchronize: true,
    });
    serializeConnection(dataSource, { maxWaitMs: MAX_WAIT_MS });
    await dataSource.initialize();
    unitOfWork = new TypeOrmUnitOfWork(dataSource);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('MinimalHealthRecord.list() sees the uncommitted rows of its own transaction', async () => {
    const repository = new TypeOrmMinimalHealthRecordRepository(dataSource);

    const rows = await unitOfWork.run(async () => {
      await repository.upsertMany('symptoms', [
        { userId: 'u1', date: '2026-01-01', payload: { a: 1 } },
      ]);
      return repository.list('symptoms', 'u1', {});
    });

    expect(rows).toEqual([
      { userId: 'u1', date: '2026-01-01', payload: { a: 1 } },
    ]);
  });

  it('ApiKey reads see the uncommitted rows of the transaction', async () => {
    const repository = new TypeOrmApiKeyRepository(dataSource);
    const key = ApiKey.restore({
      id: 'k1',
      userId: 'u1',
      label: 'l',
      hashedKey: 'h',
      lastUsedAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      revokedAt: null,
    });

    const found = await unitOfWork.run(async () => {
      await repository.save(key);
      return repository.findById('k1');
    });

    expect(found?.id).toBe('k1');
  });

  it('RevokedSession reads see the uncommitted rows of the transaction', async () => {
    const repository = new TypeOrmRevokedSessionRepository(dataSource);
    const at = new Date('2026-01-01T00:00:00Z');

    const read = await unitOfWork.run(async () => {
      await repository.markRevoked('u1', at);
      return repository.getRevokedAt('u1');
    });

    expect(read).toEqual(at);
  });
});
