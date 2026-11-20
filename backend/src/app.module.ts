import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './infrastructure/config/validate-env';
import { DatabaseModule } from './infrastructure/persistence/database.module';
import { throttlerOptions } from './interfaces/http/throttling';
import { ApiKeysModule } from './interfaces/http/modules/api-keys.module';
import { AuthModule } from './interfaces/http/modules/auth.module';
import { HealthModule } from './interfaces/http/modules/health.module';
import { StatusModule } from './interfaces/http/modules/status.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot(throttlerOptions),
    DatabaseModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'public'),
      // Backend routes (everything under /api/**, plus health/status and
      // openapi.json which stay unprefixed - see main.ts) are excluded from
      // the SPA fallback so the frontend can be served at the root path.
      exclude: ['/api*', '/health/status', '/openapi.json'],
    }),
    AuthModule,
    ApiKeysModule,
    HealthModule,
    StatusModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
