import { ConfigService } from '@nestjs/config';
import {
  createPostHogTelemetry,
  PostHogClient,
  PostHogTelemetry,
} from './posthog-telemetry';

type CaptureMessage = Parameters<PostHogClient['capture']>[0];

class FakeClient implements PostHogClient {
  readonly captured: CaptureMessage[] = [];
  shutdowns = 0;
  shutdownTimeouts: (number | undefined)[] = [];
  failing = false;

  capture(message: CaptureMessage): void {
    if (this.failing) {
      throw new Error('network');
    }
    this.captured.push(message);
  }

  async shutdown(timeoutMs?: number): Promise<void> {
    this.shutdowns += 1;
    this.shutdownTimeouts.push(timeoutMs);
    return Promise.resolve();
  }
}

const runtimeHealth = {
  name: 'runtime_health',
  properties: {
    lag_p50_ms: 1,
    lag_p99_ms: 2,
    lag_max_ms: 3,
    elu: 0.1,
    heap_used_mb: 40,
    rss_mb: 90,
  },
} as const;

describe('PostHogTelemetry', () => {
  it('is disabled without POSTHOG_API_KEY: no client is created, capture does nothing', () => {
    const factory =
      vi.fn<(apiKey: string, options: unknown) => PostHogClient>();

    const telemetry = createPostHogTelemetry(new ConfigService({}), factory);

    expect(() => {
      telemetry.capture(runtimeHealth);
    }).not.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });

  it('shuts down cleanly when disabled (no client)', async () => {
    const telemetry = createPostHogTelemetry(new ConfigService({}));

    await expect(telemetry.onApplicationShutdown()).resolves.toBeUndefined();
  });

  it('creates an EU, geoip-free, batching client when a key is set', () => {
    const factory = vi
      .fn<(apiKey: string, options: unknown) => PostHogClient>()
      .mockReturnValue(new FakeClient());

    createPostHogTelemetry(
      new ConfigService({ POSTHOG_API_KEY: 'phc_test' }),
      factory,
    );

    expect(factory).toHaveBeenCalledWith('phc_test', {
      host: 'https://eu.i.posthog.com',
      disableGeoip: true,
      flushAt: 20,
      flushInterval: 10_000,
    });
  });

  it('uses POSTHOG_HOST when set', () => {
    const factory = vi
      .fn<(apiKey: string, options: unknown) => PostHogClient>()
      .mockReturnValue(new FakeClient());

    createPostHogTelemetry(
      new ConfigService({
        POSTHOG_API_KEY: 'phc_test',
        POSTHOG_HOST: 'https://ph.example.test',
      }),
      factory,
    );

    expect(factory).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ host: 'https://ph.example.test' }),
    );
  });

  it('falls back to the EU host when POSTHOG_HOST is empty (copied .env.example)', () => {
    const factory = vi
      .fn<(apiKey: string, options: unknown) => PostHogClient>()
      .mockReturnValue(new FakeClient());

    createPostHogTelemetry(
      new ConfigService({ POSTHOG_API_KEY: 'phc_test', POSTHOG_HOST: '' }),
      factory,
    );

    expect(factory).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ host: 'https://eu.i.posthog.com' }),
    );
  });

  it('sends anonymous events: random id per event, no person profile, no IP, service name', () => {
    const client = new FakeClient();
    const telemetry = new PostHogTelemetry(client);

    telemetry.capture(runtimeHealth);
    telemetry.capture(runtimeHealth);

    const [first, second] = client.captured;
    expect(first.distinctId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.distinctId).not.toBe(second.distinctId);
    expect(first).toEqual({
      distinctId: first.distinctId,
      event: 'runtime_health',
      properties: {
        ...runtimeHealth.properties,
        service: 'home-health',
        version: 'dev',
        $ip: null,
        $process_person_profile: false,
      },
      disableGeoip: true,
    });
  });

  it('drops properties that look like personal data', () => {
    const client = new FakeClient();

    new PostHogTelemetry(client).capture({
      name: 'http_request',
      properties: {
        route: '/api/x/alice@example.com',
        method: 'GET',
        status: 200,
        duration_ms: 3,
      },
    });

    expect(client.captured[0].properties).toEqual({
      method: 'GET',
      status: 200,
      duration_ms: 3,
      service: 'home-health',
      version: 'dev',
      $ip: null,
      $process_person_profile: false,
    });
  });

  it('adds the release version (APP_VERSION) to every ops event', () => {
    vi.stubEnv('APP_VERSION', '2.5.1');
    const client = new FakeClient();
    const telemetry = new PostHogTelemetry(client);

    telemetry.capture(runtimeHealth);
    telemetry.capture(runtimeHealth);

    expect(client.captured.map((c) => c.properties['version'])).toEqual([
      '2.5.1',
      '2.5.1',
    ]);
    vi.unstubAllEnvs();
  });

  it('never throws into the caller', () => {
    const client = new FakeClient();
    client.failing = true;

    expect(() => {
      new PostHogTelemetry(client).capture(runtimeHealth);
    }).not.toThrow();
  });

  it('flushes on application shutdown', async () => {
    const client = new FakeClient();

    await new PostHogTelemetry(client).onApplicationShutdown();

    expect(client.shutdowns).toBe(1);
  });

  it('bounds the shutdown flush to 5 s, under the 10 s Docker stop timeout', async () => {
    const client = new FakeClient();

    await new PostHogTelemetry(client).onApplicationShutdown();

    expect(client.shutdownTimeouts).toEqual([5000]);
  });
});
