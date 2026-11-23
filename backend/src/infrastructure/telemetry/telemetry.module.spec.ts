import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Telemetry } from '../../domain/shared/telemetry';
import { PostHogTelemetry } from './posthog-telemetry';
import { TelemetryModule } from './telemetry.module';

describe('TelemetryModule', () => {
  afterEach(() => {
    delete process.env.POSTHOG_API_KEY;
  });

  it('provides the Telemetry port globally, without a PostHog client when POSTHOG_API_KEY is absent', async () => {
    delete process.env.POSTHOG_API_KEY;
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        TelemetryModule,
      ],
    }).compile();

    const telemetry = moduleRef.get(Telemetry);

    expect(telemetry).toBeInstanceOf(PostHogTelemetry);
    expect((telemetry as unknown as { client: unknown }).client).toBeNull();
    expect(() => {
      telemetry.capture({
        name: 'http_request',
        properties: { route: '/x', method: 'GET', status: 200, duration_ms: 1 },
      });
    }).not.toThrow();
    await moduleRef.close();
  });
});
