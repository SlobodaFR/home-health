import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ormEntities } from './entities';

/** Used by the TypeORM CLI (migration:generate / migration:run) outside of Nest's DI container. */
export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: process.env.DATABASE_PATH ?? 'data/home-health.sqlite',
  enableWAL: true,
  timeout: 5000,
  entities: ormEntities,
  migrations: [__dirname + '/migrations/*.ts'],
});
