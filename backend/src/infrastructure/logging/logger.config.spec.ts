import { Writable } from 'stream';
import pino from 'pino';
import { loggerParams, maskApiKey, REDACT_PATHS } from './logger.config';

type Serializer = (value: unknown) => unknown;

function options(nodeEnv = 'production'): Record<string, unknown> {
  return loggerParams(nodeEnv).pinoHttp as Record<string, unknown>;
}

function serializers(): { req: Serializer; res: Serializer } {
  return options().serializers as { req: Serializer; res: Serializer };
}

describe('logger configuration', () => {
  it('logs requests as method and path only: no query string, headers or IP', () => {
    const serialized = serializers().req({
      method: 'POST',
      url: '/api/auth/disconnect?secret=hook-secret',
      headers: { cookie: 'access_token=x', authorization: 'Bearer y' },
      remoteAddress: '203.0.113.7',
    });

    expect(serialized).toEqual({
      method: 'POST',
      url: '/api/auth/disconnect',
    });
  });

  it('never logs the API key carried in the ingestion and read URLs', () => {
    const key = 'hk_0123456789abcdef0123456789abcdef';
    for (const url of [
      `/api/health/${key}`,
      `/api/health/${key}/workouts?from=2026-01-01`,
      `/api/health/${key}/metrics/heart_rate`,
    ]) {
      const serialized = JSON.stringify(
        serializers().req({ method: 'GET', url, headers: {} }),
      );
      expect(serialized).not.toContain(key);
      expect(serialized).toContain('/api/health/:apiKey');
    }
  });

  it('keeps the status route readable', () => {
    expect(maskApiKey('/api/health/status')).toBe('/api/health/status');
    expect(maskApiKey('/health/status')).toBe('/health/status');
    expect(maskApiKey('/api/api-keys/abc')).toBe('/api/api-keys/abc');
  });

  it('logs responses as status code only: no Location or Set-Cookie header', () => {
    const serialized = serializers().res({
      statusCode: 302,
      headers: {
        location: 'https://app.example.com/cb?code=secret',
        'set-cookie': 'access_token=jwt',
      },
    });

    expect(serialized).toEqual({ statusCode: 302 });
  });

  it('redacts personal and secret fields in structured log objects', () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const logger = pino({ redact: REDACT_PATHS }, stream);

    logger.info(
      {
        user: { email: 'a@b.c', token: 't0k3n' },
        err: { code: 'SQLITE_BUSY' },
      },
      'event',
    );

    const output = lines.join('');
    expect(output).not.toContain('a@b.c');
    expect(output).not.toContain('t0k3n');
    expect(output).toContain('SQLITE_BUSY');
  });

  it('logs client errors as warn and server errors as error', () => {
    const level = options().customLogLevel as (
      req: unknown,
      res: { statusCode: number },
      err?: Error,
    ) => string;

    expect(level({}, { statusCode: 200 })).toBe('info');
    expect(level({}, { statusCode: 404 })).toBe('warn');
    expect(level({}, { statusCode: 500 })).toBe('error');
    expect(level({}, { statusCode: 200 }, new Error('boom'))).toBe('error');
  });

  it('skips automatic request logs for static assets and the liveness probe', () => {
    const ignore = (
      options().autoLogging as { ignore: (req: { url?: string }) => boolean }
    ).ignore;

    expect(ignore({ url: '/assets/index-abc.js' })).toBe(true);
    expect(ignore({ url: '/health/status' })).toBe(true);
    expect(ignore({ url: '/api/health/status' })).toBe(true);
    expect(ignore({ url: '/api/health/hk_key' })).toBe(false);
  });

  it('pretty-prints only in development', () => {
    expect(options('development').transport).toEqual({
      target: 'pino-pretty',
    });
    expect(options().transport).toBeUndefined();
  });
});
