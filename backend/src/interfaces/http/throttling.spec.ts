import { Controller, Get, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import {
  SkipThrottle,
  Throttle,
  ThrottlerGuard,
  ThrottlerModule,
} from '@nestjs/throttler';
import request from 'supertest';
import {
  DEFAULT_LIMIT_PER_MINUTE,
  INGESTION_LIMIT_PER_MINUTE,
  ingestionThrottle,
  THROTTLE_ERROR_MESSAGE,
  throttlerOptions,
} from './throttling';

@Controller()
class StubController {
  @Get('ping')
  ping(): string {
    return 'pong';
  }

  @Throttle(ingestionThrottle)
  @Post('ingest')
  ingest(): string {
    return 'ok';
  }

  @SkipThrottle()
  @Get('free')
  free(): string {
    return 'free';
  }
}

describe('Rate limiting (HTTP)', () => {
  let app: NestExpressApplication;

  async function createApp(
    trustProxyHops: number,
  ): Promise<NestExpressApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(throttlerOptions)],
      controllers: [StubController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    if (trustProxyHops > 0) {
      nestApp.set('trust proxy', trustProxyHops);
    }
    await nestApp.init();
    return nestApp;
  }

  afterEach(async () => {
    await app.close();
  });

  const ping = (ip: string) =>
    request(app.getHttpServer()).get('/ping').set('X-Forwarded-For', ip);

  it('answers 429 once a route exceeds its per-minute budget for one IP', async () => {
    app = await createApp(1);
    for (let i = 0; i < DEFAULT_LIMIT_PER_MINUTE; i++) {
      await ping('203.0.113.1').expect(200);
    }

    const blocked = await ping('203.0.113.1').expect(429);
    expect(blocked.body).toMatchObject({ message: THROTTLE_ERROR_MESSAGE });
  });

  it('counts each client IP separately behind one trusted proxy hop', async () => {
    app = await createApp(1);
    for (let i = 0; i < DEFAULT_LIMIT_PER_MINUTE; i++) {
      await ping('203.0.113.1').expect(200);
    }
    await ping('203.0.113.1').expect(429);

    await ping('203.0.113.2').expect(200);
  });

  it('does not trust X-Forwarded-For without TRUST_PROXY_HOPS (spoofing cannot dodge the limit)', async () => {
    app = await createApp(0);
    for (let i = 0; i < DEFAULT_LIMIT_PER_MINUTE; i++) {
      await ping(`203.0.113.${String(i % 200)}`).expect(200);
    }

    await ping('198.51.100.9').expect(429);
  });

  it('gives device ingestion a larger budget than interactive routes', async () => {
    app = await createApp(1);
    // Well past the default budget: a first Health Auto Export sync must not be cut off.
    for (let i = 0; i < DEFAULT_LIMIT_PER_MINUTE + 50; i++) {
      await request(app.getHttpServer())
        .post('/ingest')
        .set('X-Forwarded-For', '203.0.113.7')
        .expect(201);
    }
    expect(INGESTION_LIMIT_PER_MINUTE).toBeGreaterThan(
      DEFAULT_LIMIT_PER_MINUTE + 50,
    );
  });

  it('keeps a bounded ingestion budget', async () => {
    app = await createApp(1);
    for (let i = 0; i < INGESTION_LIMIT_PER_MINUTE; i++) {
      await request(app.getHttpServer())
        .post('/ingest')
        .set('X-Forwarded-For', '203.0.113.8')
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/ingest')
      .set('X-Forwarded-For', '203.0.113.8')
      .expect(429);
  });

  it('never limits routes marked @SkipThrottle', async () => {
    app = await createApp(1);
    for (let i = 0; i < DEFAULT_LIMIT_PER_MINUTE + 10; i++) {
      await request(app.getHttpServer())
        .get('/free')
        .set('X-Forwarded-For', '203.0.113.9')
        .expect(200);
    }
  });
});
