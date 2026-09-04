import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ormEntities } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3' as const,
        database: config.get<string>(
          'DATABASE_PATH',
          'data/home-health.sqlite',
        ),
        enableWAL: true,
        // Wait for Litestream's WAL checkpoints (and other writers) to
        // release the lock instead of throwing "database is locked"
        // immediately - see the retry loop this guards in the "sync error"
        // logs from the Litestream sidecar.
        timeout: 5000,
        entities: ormEntities,
        migrationsRun: true,
        migrations: [__dirname + '/migrations/*.js'],
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
