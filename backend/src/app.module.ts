import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { DatabaseModule } from './infrastructure/persistence/database.module';
import { ApiKeysModule } from './interfaces/http/modules/api-keys.module';
import { AuthModule } from './interfaces/http/modules/auth.module';
import { HealthIngestionModule } from './interfaces/http/modules/health-ingestion.module';
import { StatusModule } from './interfaces/http/modules/status.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'public'),
      // Backend routes (health/*, api-keys/*, auth/*, openapi.json) are excluded
      // from the SPA fallback so the frontend can be served at the root path.
      exclude: ['/health*', '/api-keys*', '/auth*', '/openapi.json'],
    }),
    AuthModule,
    ApiKeysModule,
    HealthIngestionModule,
    StatusModule,
  ],
})
export class AppModule {}
