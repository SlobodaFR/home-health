import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CreateApiKeyUseCase } from '../../application/api-keys/create-api-key.use-case';
import { ListApiKeysUseCase } from '../../application/api-keys/list-api-keys.use-case';
import { RevokeApiKeyUseCase } from '../../application/api-keys/revoke-api-key.use-case';
import { InitiateServiceLogoutUseCase } from '../../application/auth/initiate-service-logout.use-case';
import { OAuthClient } from '../../domain/auth/oauth-client';
import { RevokedSessionRepository } from '../../domain/auth/revoked-session.repository';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { ApiKeysController } from './controllers/api-keys.controller';
import { AuthController } from './controllers/auth.controller';
import { HealthIngestionController } from './controllers/health-ingestion.controller';
import { SameOriginGuard } from './guards/same-origin.guard';

const GUARDS_METADATA = '__guards__';

const guardsOf = (target: object): unknown[] =>
  (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[] | undefined) ?? [];

const methodGuards = (
  controller: { prototype: object },
  method: string,
): unknown[] =>
  guardsOf((controller.prototype as Record<string, object>)[method]);

describe('SameOriginGuard wiring', () => {
  it('protects every cookie-authenticated mutation', () => {
    expect(guardsOf(ApiKeysController)).toContain(SameOriginGuard);
    expect(methodGuards(AuthController, 'logout')).toContain(SameOriginGuard);
  });

  it('leaves server-to-server and key-authenticated routes alone', () => {
    // home-auth logout webhook (secret in the query) and device ingestion (API key in the URL)
    // carry no cookie and no browser Origin: the guard would break them.
    expect(methodGuards(AuthController, 'disconnect')).not.toContain(
      SameOriginGuard,
    );
    expect(guardsOf(AuthController)).not.toContain(SameOriginGuard);
    expect(guardsOf(HealthIngestionController)).not.toContain(SameOriginGuard);
    expect(methodGuards(HealthIngestionController, 'ingest')).not.toContain(
      SameOriginGuard,
    );
  });

  describe('over HTTP', () => {
    let app: NestExpressApplication;
    const revoke = vi.fn<RevokeApiKeyUseCase['execute']>();

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [ApiKeysController, AuthController],
        providers: [
          {
            // Stands in for JwtAuthGuard (runs first, like the real global guard).
            provide: APP_GUARD,
            useValue: {
              canActivate: (context: ExecutionContext) => {
                const req = context
                  .switchToHttp()
                  .getRequest<{ user?: object }>();
                req.user = { id: 'user-1', email: 'a@b.c', name: 'Test' };
                return true;
              },
            },
          },
          {
            provide: ConfigService,
            useValue: new ConfigService({
              PUBLIC_BASE_URL: 'https://health.example.test',
            }),
          },
          { provide: CreateApiKeyUseCase, useValue: {} },
          { provide: ListApiKeysUseCase, useValue: {} },
          { provide: RevokeApiKeyUseCase, useValue: { execute: revoke } },
          { provide: OAuthClient, useValue: {} },
          { provide: RevokedSessionRepository, useValue: {} },
          { provide: FeatureFlags, useValue: {} },
          { provide: InitiateServiceLogoutUseCase, useValue: {} },
        ],
      }).compile();
      app = moduleRef.createNestApplication<NestExpressApplication>();
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('refuses a cross-site key revocation and runs a same-origin one', async () => {
      await request(app.getHttpServer())
        .delete('/api-keys/abc')
        .set('Sec-Fetch-Site', 'same-site')
        .expect(403);
      expect(revoke).not.toHaveBeenCalled();

      await request(app.getHttpServer())
        .delete('/api-keys/abc')
        .set('Sec-Fetch-Site', 'same-origin')
        .expect(204);
      expect(revoke).toHaveBeenCalledOnce();
    });

    it('refuses a cross-site logout', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Origin', 'https://evil.example.test')
        .expect(403);
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Origin', 'https://health.example.test')
        .expect(200);
    });
  });
});
