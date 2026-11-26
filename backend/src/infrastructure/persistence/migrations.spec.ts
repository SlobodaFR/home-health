import { mkdtempSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { ormEntities } from './entities';
import { MIGRATIONS } from './migrations';

function dataSource(database: string, synchronize = false): DataSource {
  return new DataSource({
    type: 'better-sqlite3',
    database,
    entities: ormEntities,
    migrations: MIGRATIONS,
    synchronize,
  });
}

const tempFile = (name: string) =>
  join(mkdtempSync(join(tmpdir(), 'db-')), name);

interface MasterRow {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

// `migrations` (and sqlite_sequence, created by its AUTOINCREMENT key) only exist with migrations.
const schemaOf = (ds: DataSource): Promise<MasterRow[]> =>
  ds.query(
    `SELECT type, name, tbl_name, sql FROM sqlite_master
     WHERE tbl_name NOT IN ('migrations', 'sqlite_sequence') ORDER BY type, name`,
  );

async function tablesOf(ds: DataSource): Promise<string[]> {
  const rows: { name: string }[] = await ds.query(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT IN ('migrations', 'sqlite_sequence') ORDER BY name`,
  );
  return rows.map((row) => row.name);
}

// One row in every table, built from the schema itself (NOT NULL columns get a value of their type).
async function sampleRows(ds: DataSource): Promise<string[]> {
  const inserts: string[] = [];
  for (const name of await tablesOf(ds)) {
    const columns: { name: string; type: string }[] = await ds.query(
      `PRAGMA table_info("${name}")`,
    );
    const values = columns.map((column) => {
      if (column.type === 'integer' || column.type === 'boolean') return '1';
      if (column.type === 'real') return '1.5';
      if (column.type === 'datetime') return "'2026-01-01 00:00:00'";
      return `'${name}-${column.name}'`;
    });
    inserts.push(
      `INSERT INTO "${name}" (${columns.map((column) => `"${column.name}"`).join(', ')}) VALUES (${values.join(', ')})`,
    );
  }
  return inserts;
}

async function dumpRows(ds: DataSource): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const table of await tablesOf(ds)) {
    out[table] = await ds.query(`SELECT * FROM "${table}" ORDER BY 1`);
  }
  return out;
}

const MIGRATION_NAMES = MIGRATIONS.map((migration) => migration.name);

describe('database migrations', () => {
  // Any entity change without its migration makes this fail.
  it('produce exactly the schema the entities describe', async () => {
    const ds = dataSource(':memory:');
    await ds.initialize();
    await ds.runMigrations();

    const pending = await ds.driver.createSchemaBuilder().log();

    expect(pending.upQueries.map((query) => query.query)).toEqual([]);
    await ds.destroy();
  });

  it('create the same sqlite_master as synchronize does (apart from the migrations table)', async () => {
    const synced = dataSource(':memory:', true);
    await synced.initialize();
    const migrated = dataSource(':memory:');
    await migrated.initialize();
    await migrated.runMigrations();

    expect(await schemaOf(migrated)).toEqual(await schemaOf(synced));
    await synced.destroy();
    await migrated.destroy();
  });

  // Production was built by these very migrations: booting it again must change nothing.
  it('leave a database built by the migrations untouched when it boots again', async () => {
    const file = tempFile('prod.sqlite');
    const first = dataSource(file);
    await first.initialize();
    await first.runMigrations();
    for (const sql of await sampleRows(first)) await first.query(sql);
    const rowsBefore = await dumpRows(first);
    const schemaBefore = await schemaOf(first);
    await first.destroy();

    for (let boot = 0; boot < 2; boot++) {
      const again = dataSource(file);
      await again.initialize();
      const applied = await again.runMigrations();

      expect(applied).toEqual([]);
      expect(await dumpRows(again)).toEqual(rowsBefore);
      expect(await schemaOf(again)).toEqual(schemaBefore);
      const recorded: { name: string }[] = await again.query(
        'SELECT name FROM migrations ORDER BY id',
      );
      expect(recorded.map((row) => row.name)).toEqual(MIGRATION_NAMES);
      expect(
        (await again.driver.createSchemaBuilder().log()).upQueries,
      ).toEqual([]);
      expect(await again.query('PRAGMA integrity_check')).toEqual([
        { integrity_check: 'ok' },
      ]);
      await again.destroy();
    }
  });

  // Migrations are listed by hand (no glob): a file left out of the list would never run.
  it('list every migration file of the migrations folder, oldest first', () => {
    const dir = join(__dirname, 'migrations');
    const declared = readdirSync(dir)
      .filter((file) => file.endsWith('.ts') && file !== 'index.ts')
      .map((file) => {
        const match = /export class (\w+?\d{13})\b/.exec(
          readFileSync(join(dir, file), 'utf8'),
        );
        return match?.[1] ?? `no migration class in ${file}`;
      });

    expect([...MIGRATION_NAMES].sort((a, b) => a.localeCompare(b))).toEqual(
      declared.sort((a, b) => a.localeCompare(b)),
    );
    const timestamps = MIGRATION_NAMES.map((name) =>
      Number(/\d{13}$/.exec(name)?.[0]),
    );
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });

  // forFeature() with an entity missing from ormEntities would fail at boot with "No metadata".
  it('list every @Entity file of the entities folder in ormEntities', async () => {
    const dir = join(__dirname, 'entities');
    // minimal-health-record is an abstract base class: no @Entity of its own.
    const declared = readdirSync(dir)
      .filter((file) => file.endsWith('.orm-entity.ts'))
      .flatMap((file) => {
        const match = /@Entity\(\{ name: '(\w+)' \}\)/.exec(
          readFileSync(join(dir, file), 'utf8'),
        );
        return match?.[1] ? [match[1]] : [];
      });
    const ds = dataSource(':memory:');
    await ds.initialize();

    const byName = (a: string, b: string) => a.localeCompare(b);
    expect(
      ds.entityMetadatas.map((meta) => meta.tableName).sort(byName),
    ).toEqual(declared.sort(byName));
    expect(declared).toHaveLength(ormEntities.length);
    await ds.destroy();
  });

  // A mistaken `migration:revert` must not wipe production: the baseline refuses.
  it('refuse to revert the baseline migration and keep the data', async () => {
    const ds = dataSource(':memory:');
    await ds.initialize();
    await ds.runMigrations();
    for (const sql of await sampleRows(ds)) await ds.query(sql);
    const rowsBefore = await dumpRows(ds);

    // The revert undoes the latest migration first, then the baseline.
    await ds.undoLastMigration();
    const tablesBeforeBaseline = await tablesOf(ds);
    await expect(ds.undoLastMigration()).rejects.toThrow(
      /baseline migration: revert not supported, restore a backup/,
    );

    expect(await tablesOf(ds)).toEqual(tablesBeforeBaseline);
    expect(tablesBeforeBaseline).toEqual(
      Object.keys(rowsBefore).filter((table) => table !== 'revoked_sessions'),
    );
    await ds.destroy();
  });
});
