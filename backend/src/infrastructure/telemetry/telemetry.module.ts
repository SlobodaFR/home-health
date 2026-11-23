import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Telemetry } from '../../domain/shared/telemetry';
import { TelemetryInterceptor } from '../../interfaces/http/telemetry.interceptor';
import { createPostHogTelemetry } from './posthog-telemetry';

/** Global: RuntimeHealthMonitor and the interceptor receive the port without importing the module. */
@Global()
@Module({
  providers: [
    {
      provide: Telemetry,
      useFactory: (config: ConfigService) => createPostHogTelemetry(config),
      inject: [ConfigService],
    },
    { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
  ],
  exports: [Telemetry],
})
export class TelemetryModule {}
