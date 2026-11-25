import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  Controller,
  ExecutionContext,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  RequestMethod,
} from '@nestjs/common';
import { APP_INTERCEPTOR, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ServeStaticModule } from '@nestjs/serve-static';
import { lastValueFrom, of } from 'rxjs';
import request from 'supertest';
import { FakeTelemetry } from '../../application/test/fake-telemetry';
import { Telemetry } from '../../domain/shared/telemetry';
import { TelemetryInterceptor } from './telemetry.interceptor';

const API_KEY = 'hk_0123456789abcdef0123456789abcdef0123456789abcdef';

// Same shapes as the real controllers: the API key is a path parameter of the health routes.
@Controller('health')
class IngestionController {
  @Post(':apiKey')
  ingest(@Param('apiKey') apiKey: string): { ok: boolean } {
    return { ok: apiKey.length > 0 };
  }
}

@Controller('health/:apiKey')
class ReadController {
  @Get('metrics')
  metrics(): { items: [] } {
    return { items: [] };
  }

  @Get('workouts/:id')
  workout(@Param('id') id: string): { id: string } {
    if (id === 'missing') {
      throw new NotFoundException('nope');
    }
    return { id };
  }
}

// Liveness probes, outside the /api prefix (see main.ts).
@Controller('health/status')
class StatusController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}

@Controller('healthz')
class HealthzController {
  @Get()
  healthz(): string {
    return 'ok';
  }
}

@Controller('auth')
class AuthController {
  @Get('me')
  me(): { id: string } {
    return { id: 'u1' };
  }

  @Get('boom')
  boom(): never {
    throw new TypeError('secret detail about alice@example.com');
  }
}

describe('HTTP telemetry', () => {
  let app: NestExpressApplication;
  let telemetry: FakeTelemetry;
  let staticRoot: string;

  beforeEach(async () => {
    staticRoot = mkdtempSync(join(tmpdir(), 'health-static-'));
    writeFileSync(join(staticRoot, 'index.html'), '<html>spa</html>');
    writeFileSync(join(staticRoot, 'app.js'), 'console.log(1)');
    telemetry = new FakeTelemetry();
    // NestFactory (not Test): ServeStaticModule picks its loader from the real HTTP adapter.
    @Module({
      imports: [
        ServeStaticModule.forRoot({
          rootPath: staticRoot,
          exclude: [
            '/api{/*path}',
            '/health/status',
            '/healthz{/*path}',
            '/openapi.json',
          ],
        }),
      ],
      controllers: [
        IngestionController,
        ReadController,
        StatusController,
        HealthzController,
        AuthController,
      ],
      providers: [
        { provide: Telemetry, useValue: telemetry },
        { provide: APP_INTERCEPTOR, useClass: TelemetryInterceptor },
      ],
    })
    class TestAppModule {}
    app = await NestFactory.create<NestExpressApplication>(TestAppModule, {
      logger: false,
    });
    // Same prefix and exclusions as main.ts.
    app.setGlobalPrefix('api', {
      exclude: [
        { path: 'health/status', method: RequestMethod.GET },
        { path: 'healthz', method: RequestMethod.GET },
      ],
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    rmSync(staticRoot, { recursive: true, force: true });
  });

  it('reports each request with its route template, never the raw URL or query', async () => {
    await request(app.getHttpServer())
      .get(`/api/health/${API_KEY}/workouts/42?token=secret`)
      .expect(200);

    expect(telemetry.names()).toEqual(['http_request']);
    const { properties } = telemetry.captured[0].event as {
      properties: Record<string, unknown>;
    };
    expect(properties).toEqual({
      route: '/api/health/:apiKey/workouts/:id',
      method: 'GET',
      status: 200,
      duration_ms: expect.any(Number),
    });
    expect(JSON.stringify(telemetry.captured)).not.toMatch(
      /workouts\/42|secret|hk_0123/,
    );
  });

  it('never reports the API key of the ingestion route (POST /api/health/:apiKey)', async () => {
    await request(app.getHttpServer())
      .post(`/api/health/${API_KEY}`)
      .send({})
      .expect(201);

    expect(telemetry.captured.map(({ event }) => event)).toEqual([
      {
        name: 'http_request',
        properties: {
          route: '/api/health/:apiKey',
          method: 'POST',
          status: 201,
          duration_ms: expect.any(Number),
        },
      },
    ]);
    expect(JSON.stringify(telemetry.captured)).not.toContain(API_KEY);
    expect(JSON.stringify(telemetry.captured)).not.toContain('hk_');
  });

  it('never reports the API key of the read routes (GET /api/health/:apiKey/metrics)', async () => {
    await request(app.getHttpServer())
      .get(`/api/health/${API_KEY}/metrics`)
      .expect(200);

    expect(telemetry.captured[0].event).toMatchObject({
      properties: { route: '/api/health/:apiKey/metrics' },
    });
    expect(JSON.stringify(telemetry.captured)).not.toContain(API_KEY);
  });

  it('reports client errors with their status', async () => {
    await request(app.getHttpServer())
      .get(`/api/health/${API_KEY}/workouts/missing`)
      .expect(404);

    expect(telemetry.names()).toEqual(['http_request']);
    expect(telemetry.captured[0].event).toMatchObject({
      properties: { route: '/api/health/:apiKey/workouts/:id', status: 404 },
    });
  });

  it('reports server errors with status 500 and no error detail', async () => {
    await request(app.getHttpServer()).get('/api/auth/boom').expect(500);

    expect(telemetry.names()).toEqual(['http_request']);
    expect(telemetry.captured[0].event).toMatchObject({
      properties: { route: '/api/auth/boom', status: 500 },
    });
    expect(JSON.stringify(telemetry.captured)).not.toContain('alice');
  });

  it('does not report /healthz (polled by Docker)', async () => {
    await request(app.getHttpServer()).get('/healthz').expect(200);

    expect(telemetry.captured).toEqual([]);
  });

  it('does not report /health/status (liveness probe)', async () => {
    await request(app.getHttpServer()).get('/health/status').expect(200);

    expect(telemetry.captured).toEqual([]);
  });

  it('reports nothing for a request that matches no Nest route', async () => {
    // POST: the SPA fallback only answers GET, so Nest's own 404 handles it.
    await request(app.getHttpServer())
      .post('/api/nope/alice@example.com?email=bob@example.com')
      .expect(404);

    expect(telemetry.captured).toEqual([]);
  });

  it('keeps backend paths out of the SPA fallback (JSON 404, not index.html)', async () => {
    for (const path of ['/api/nope', '/api']) {
      const res = await request(app.getHttpServer()).get(path).expect(404);
      expect(res.headers['content-type']).toContain('application/json');
    }
  });

  it('does not serve the SPA under /healthz sub-paths', async () => {
    // Nest 12 scopes its JSON 404 handler to the global prefix and the exact excluded paths, so a
    // sub-path of /healthz (internal, blocked by Caddy) gets Express's own 404 - never index.html.
    const res = await request(app.getHttpServer())
      .get('/healthz/x')
      .expect(404);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).not.toContain('spa');
  });

  it('reports nothing for static assets and SPA fallback pages (served outside Nest routes)', async () => {
    await request(app.getHttpServer()).get('/app.js').expect(200);
    await request(app.getHttpServer()).get('/').expect(200);
    await request(app.getHttpServer()).get('/settings/keys').expect(200);

    expect(telemetry.captured).toEqual([]);
  });

  it('ignores non-HTTP contexts: a WebSocket handler sharing the global interceptor emits nothing', async () => {
    const interceptor = new TelemetryInterceptor(telemetry);
    const next = { handle: () => of('pong') };
    const wsContext = {
      getType: () => 'ws',
      switchToHttp: () => {
        throw new Error('must not read an HTTP request on a ws context');
      },
    } as unknown as ExecutionContext;

    await lastValueFrom(interceptor.intercept(wsContext, next));

    expect(telemetry.captured).toEqual([]);
  });

  it('emits nothing when the request carries no matched route', async () => {
    const interceptor = new TelemetryInterceptor(telemetry);
    const next = { handle: () => of('ok') };
    const httpContext = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', baseUrl: '' }),
        getResponse: () => ({ statusCode: 200 }),
      }),
    } as unknown as ExecutionContext;

    await lastValueFrom(interceptor.intercept(httpContext, next));

    expect(telemetry.captured).toEqual([]);
  });

  it('never reports an email carried by a query string or a path parameter', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/health/alice@example.com/workouts/bob@example.com?email=carol@example.com',
      )
      .expect(200);

    expect(telemetry.names()).toEqual(['http_request']);
    expect(JSON.stringify(telemetry.captured)).not.toMatch(/alice|bob|carol|@/);
    expect(telemetry.captured[0].event).toMatchObject({
      properties: { route: '/api/health/:apiKey/workouts/:id' },
    });
  });
});
