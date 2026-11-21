import { Writable } from 'stream';
import pino from 'pino';
import { QueryFailedError } from 'typeorm';
import { loggerParams, maskApiKey, REDACT_PATHS } from './logger.config';

type Serializer = (value: unknown) => unknown;

function options(nodeEnv = 'production'): Record<string, unknown> {
  return loggerParams(nodeEnv).pinoHttp as Record<string, unknown>;
}

function serializers(): { req: Serializer; res: Serializer; err: Serializer } {
  return options().serializers as {
    req: Serializer;
    res: Serializer;
    err: Serializer;
  };
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

  it('masks the API key whatever the casing or slashes (Express routing is lenient)', () => {
    for (const url of [
      '/API/HEALTH/hk_SECRET',
      '/API/health/hk_SECRET/WORKOUTS',
      '/api/health//hk_SECRET',
      '//api/health/hk_SECRET',
      '/api/health/status/hk_SECRET',
      '/api/health/hk_SECRET/health/status/x',
    ]) {
      const serialized = JSON.stringify(
        serializers().req({ method: 'GET', url, headers: {} }),
      );
      expect(serialized).not.toContain('hk_SECRET');
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

  it('logs errors as type, message, stack and code only: no query parameters or driver error', () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const driverError = Object.assign(
      new Error('SQLITE_BUSY: database is locked'),
      {
        code: 'SQLITE_BUSY',
      },
    );
    const error = new QueryFailedError(
      'INSERT INTO workout (name, notes) VALUES (?, ?)',
      ['Alice Martin', 'alice@example.com'],
      driverError,
    );
    const logger = pino(
      { redact: REDACT_PATHS, serializers: { err: serializers().err } },
      stream,
    );

    logger.error({ err: error }, 'request failed');

    const output = lines.join('');
    expect(output).not.toContain('alice@example.com');
    expect(output).not.toContain('Alice Martin');
    expect(output).not.toContain('INSERT INTO');
    expect(output).toContain('QueryFailedError');
    expect(output).toContain('SQLITE_BUSY');
    expect(Object.keys(JSON.parse(output).err).sort()).toEqual([
      'code',
      'message',
      'stack',
      'type',
    ]);
  });

  it('prefers originalUrl so the path is masked even behind a mounted router', () => {
    const serialized = serializers().req({
      method: 'GET',
      url: '/hk_SECRET/workouts',
      originalUrl: '/api/health/hk_SECRET/workouts?from=x',
      headers: {},
    });

    expect(JSON.stringify(serialized)).not.toContain('hk_SECRET');
    expect(serialized).toEqual({
      method: 'GET',
      url: '/api/health/:apiKey/workouts',
    });
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
