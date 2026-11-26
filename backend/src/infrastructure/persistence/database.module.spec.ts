import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DatabaseModule } from './database.module';
import { currentManager, TypeOrmUnitOfWork } from './typeorm-unit-of-work';

describe('DatabaseModule', () => {
  async function boot(databasePath = ':memory:') {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ DATABASE_PATH: databasePath })],
        }),
        DatabaseModule,
      ],
    }).compile();
    await moduleRef.init();
    return moduleRef;
  }

  it('serializes the transactions of the production connection', async () => {
    const moduleRef = await boot();
    const dataSource = moduleRef.get(DataSource);

    // TypeORM's own driver returns one shared runner for every caller.
    expect(dataSource.createQueryRunner()).not.toBe(
      dataSource.createQueryRunner(),
    );

    await moduleRef.close();
  });

  it('keeps a write made during another request unit of work when that one rolls back', async () => {
    const moduleRef = await boot();
    const dataSource = moduleRef.get(DataSource);
    const unitOfWork = new TypeOrmUnitOfWork(dataSource);
    await dataSource.query('CREATE TABLE probe (id TEXT PRIMARY KEY)');

    let aHasWritten!: () => void;
    const aWrote = new Promise<void>((resolve) => (aHasWritten = resolve));
    const a = unitOfWork
      .run(async () => {
        await currentManager(dataSource).query(
          "INSERT INTO probe (id) VALUES ('a')",
        );
        aHasWritten();
        await new Promise((resolve) => setTimeout(resolve, 50));
        throw new Error('request A fails');
      })
      .catch(() => undefined);
    await aWrote;
    // Request B writes through the plain DataSource while A's transaction is open.
    await dataSource.query("INSERT INTO probe (id) VALUES ('b')");
    await a;

    const rows: { id: string }[] = await dataSource.query(
      'SELECT id FROM probe ORDER BY id',
    );
    expect(rows).toEqual([{ id: 'b' }]);

    await moduleRef.close();
  });

  it('wires SchemaGuard: boot refuses a database that drifted from the entities', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'db-')), 'drift.sqlite');
    const first = await boot(file);
    await first
      .get(DataSource)
      .query('DROP INDEX "IDX_a3baee01d8408cd3c0f89a9a97"');
    await first.close();

    await expect(boot(file)).rejects.toThrow(
      /differs from the entities.*add a migration/,
    );
  });
});
