import { DataSource } from 'typeorm';
import { ormEntities } from './entities';
import { MIGRATIONS } from './migrations';
import { SchemaGuard } from './schema-guard';

async function source(migrate: boolean): Promise<DataSource> {
  const ds = new DataSource({
    type: 'better-sqlite3',
    database: ':memory:',
    entities: ormEntities,
    migrations: MIGRATIONS,
    synchronize: false,
  });
  await ds.initialize();
  if (migrate) await ds.runMigrations();
  return ds;
}

describe('SchemaGuard', () => {
  it('lets a migrated database start', async () => {
    const ds = await source(true);

    await expect(new SchemaGuard(ds).onModuleInit()).resolves.toBeUndefined();
    await ds.destroy();
  });

  it('refuses to start when the schema differs from the entities', async () => {
    const ds = await source(false);

    await expect(new SchemaGuard(ds).onModuleInit()).rejects.toThrow(
      /differs from the entities.*add a migration/,
    );
    await ds.destroy();
  });

  it('refuses a migrated database that has drifted', async () => {
    const ds = await source(true);
    await ds.query('DROP INDEX "IDX_a3baee01d8408cd3c0f89a9a97"');

    await expect(new SchemaGuard(ds).onModuleInit()).rejects.toThrow(
      /differs from the entities/,
    );
    await ds.destroy();
  });
});
