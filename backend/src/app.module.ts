import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { loggerParams } from './infrastructure/logging/logger.config';
import { validateEnv } from './infrastructure/config/validate-env';
import { FeatureFlagsModule } from './infrastructure/feature-flags/feature-flags.module';
import { DatabaseModule } from './infrastructure/persistence/database.module';
import { throttlerOptions } from './interfaces/http/throttling';
import { ApiKeysModule } from './interfaces/http/modules/api-keys.module';
import { AuthModule } from './interfaces/http/modules/auth.module';
import { HealthModule } from './interfaces/http/modules/health.module';
import { RuntimeHealthModule } from './interfaces/http/modules/runtime-health.module';
import { StatusModule } from './interfaces/http/modules/status.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot(loggerParams(process.env.NODE_ENV)),
    ThrottlerModule.forRoot(throttlerOptions),
    DatabaseModule,
    FeatureFlagsModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'public'),
      // Backend routes (everything under /api/**, plus health/status and
      // openapi.json which stay unprefixed - see main.ts) are excluded from
      // the SPA fallback so the frontend can be served at the root path.
      exclude: ['/api*', '/health/status', '/healthz*', '/openapi.json'],
    }),
    AuthModule,
    ApiKeysModule,
    HealthModule,
    StatusModule,
    RuntimeHealthModule,
  ],
  // Must stay in the root module: global guards run in module-scan order, so the rate limit
  // applies before JwtAuthGuard (AuthModule).
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
