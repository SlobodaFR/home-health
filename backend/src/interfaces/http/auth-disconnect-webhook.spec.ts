import { randomUUID } from 'crypto';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { InitiateServiceLogoutUseCase } from '../../application/auth/initiate-service-logout.use-case';
import { OAuthClient } from '../../domain/auth/oauth-client';
import { RevokedSessionRepository } from '../../domain/auth/revoked-session.repository';
import { computeWebhookSignature } from '../../domain/auth/webhook-signature';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { AuthController } from './controllers/auth.controller';
import { jsonBodyParser } from './raw-body';

const SIGNING_SECRET =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const OTHER_SECRET =
  'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
const LEGACY_SECRET = 'legacy-query-secret';
const STRICT_FLAG = 'auth-webhook-require-signature';

describe('POST /api/auth/disconnect (signed webhook, PC7, double acceptance)', () => {
  let app: NestExpressApplication;
  let config: Record<string, string | undefined>;
  let strict: boolean | 'throws';
  let flagCalls: [string, boolean][];
  const markRevoked = vi.fn<RevokedSessionRepository['markRevoked']>();

  const flags: FeatureFlags = {
    isEnabled: (key, codeDefault) => {
      flagCalls.push([key, codeDefault]);
      return strict === 'throws'
        ? Promise.reject(new Error('flags down'))
        : Promise.resolve(strict);
    },
  };

  async function start(): Promise<void> {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: OAuthClient, useValue: {} },
        { provide: RevokedSessionRepository, useValue: { markRevoked } },
        { provide: FeatureFlags, useValue: flags },
        { provide: InitiateServiceLogoutUseCase, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => config[key],
            getOrThrow: (key: string) => {
              const value = config[key];
              if (value === undefined) {
                throw new Error(`${key} missing`);
              }
              return value;
            },
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    app.setGlobalPrefix('api');
    app.use(jsonBodyParser(1024 * 1024));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  }

  beforeEach(async () => {
    config = {
      AUTH_WEBHOOK_SECRET: LEGACY_SECRET,
      AUTH_WEBHOOK_SIGNING_SECRET: SIGNING_SECRET,
    };
    strict = false;
    flagCalls = [];
    markRevoked.mockReset();
    markRevoked.mockResolvedValue(undefined);
    await start();
  });

  afterEach(async () => {
    await app.close();
  });

  const now = () => Math.floor(Date.now() / 1000);

  /** Headers home-auth sends: the signature covers the exact body string. */
  function signed(
    body: string,
    options: {
      secrets?: string[];
      id?: string;
      timestamp?: number;
    } = {},
  ): Record<string, string> {
    const id = options.id ?? randomUUID();
    const timestamp = String(options.timestamp ?? now());
    const entries = (options.secrets ?? [SIGNING_SECRET]).map(
      (secret) => `v1=${computeWebhookSignature(secret, id, timestamp, body)}`,
    );
    return {
      'X-Auth-Webhook-Id': id,
      'X-Auth-Webhook-Timestamp': timestamp,
      'X-Auth-Webhook-Signature': entries.join(','),
    };
  }

  const post = (
    body: string,
    headers: Record<string, string> = {},
    query = '',
  ) =>
    request(app.getHttpServer())
      .post(`/api/auth/disconnect${query}`)
      .set('Content-Type', 'application/json')
      .set(headers)
      .send(body);

  const BODY = JSON.stringify({ userId: 'u1' });

  describe('without AUTH_WEBHOOK_SIGNING_SECRET (legacy path only)', () => {
    let errored: string[];
    let restoreError: () => void;

    afterEach(() => {
      restoreError();
    });

    beforeEach(async () => {
      errored = [];
      const spy = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation((message: unknown) => {
          errored.push(String(message));
        });
      restoreError = () => spy.mockRestore();
      await app.close();
      delete config.AUTH_WEBHOOK_SIGNING_SECRET;
      await start();
    });

    it('accepts the legacy ?secret=', async () => {
      await post(BODY, {}, `?secret=${LEGACY_SECRET}`).expect(204);
      expect(markRevoked).toHaveBeenCalledWith('u1', expect.any(Date));
    });

    it('refuses a wrong or missing secret', async () => {
      await post(BODY, {}, '?secret=nope').expect(401);
      await post(BODY).expect(401);
      expect(markRevoked).not.toHaveBeenCalled();
    });

    it('ignores a signature it cannot verify', async () => {
      await post(BODY, signed(BODY), `?secret=${LEGACY_SECRET}`).expect(204);
      await post(BODY, signed(BODY)).expect(401);
    });

    it('strict flag on without a signing secret: fails closed, even with the legacy secret', async () => {
      strict = true;
      await post(BODY, {}, `?secret=${LEGACY_SECRET}`).expect(401);
      await post(BODY, signed(BODY), `?secret=${LEGACY_SECRET}`).expect(401);
      await post(BODY).expect(401);
      expect(markRevoked).not.toHaveBeenCalled();
    });

    it('logs the strict-without-secret misconfiguration once', async () => {
      strict = true;
      await post(BODY, {}, `?secret=${LEGACY_SECRET}`).expect(401);
      await post(BODY, {}, `?secret=${LEGACY_SECRET}`).expect(401);
      expect(errored).toHaveLength(1);
      expect(errored[0]).toContain('AUTH_WEBHOOK_SIGNING_SECRET');
    });
  });

  describe('with the signing secret, strict flag off (double acceptance)', () => {
    it('accepts a valid signature without ?secret=', async () => {
      await post(BODY, signed(BODY)).expect(204);
      expect(markRevoked).toHaveBeenCalledWith('u1', expect.any(Date));
    });

    it('does not even evaluate the flag when the signature is valid', async () => {
      await post(BODY, signed(BODY)).expect(204);
      expect(flagCalls).toEqual([]);
    });

    it('accepts a valid signature next to a wrong ?secret=', async () => {
      await post(BODY, signed(BODY), '?secret=nope').expect(204);
    });

    it('accepts the legacy ?secret= without signature, asking the flag with code default false', async () => {
      await post(BODY, {}, `?secret=${LEGACY_SECRET}`).expect(204);
      expect(flagCalls).toEqual([[STRICT_FLAG, false]]);
    });

    it('accepts the legacy ?secret= next to an invalid signature', async () => {
      await post(
        BODY,
        signed(BODY, { secrets: [OTHER_SECRET] }),
        `?secret=${LEGACY_SECRET}`,
      ).expect(204);
    });

    it('refuses an invalid signature without ?secret=', async () => {
      await post(BODY, signed(BODY, { secrets: [OTHER_SECRET] })).expect(401);
      expect(markRevoked).not.toHaveBeenCalled();
    });

    it('refuses neither signature nor secret', async () => {
      await post(BODY).expect(401);
    });

    it('accepts when any of several v1= entries matches (secret overlap)', async () => {
      await post(
        BODY,
        signed(BODY, { secrets: [OTHER_SECRET, SIGNING_SECRET] }),
      ).expect(204);
    });

    it('verifies the exact bytes received, not a re-serialization', async () => {
      const spaced = '{ "userId" :  "u1" }';
      await post(spaced, signed(spaced)).expect(204);
      // Signed over the compact form but sent spaced: same JSON, different bytes.
      await post(spaced, signed(BODY)).expect(401);
    });

    it('signs UTF-8 bytes (non-ASCII user id)', async () => {
      const body = '{"userId":"4b8f-é"}';
      await post(body, signed(body)).expect(204);
      expect(markRevoked).toHaveBeenCalledWith('4b8f-é', expect.any(Date));
    });

    it('refuses a body altered after signing', async () => {
      await post('{"userId":"u2"}', signed(BODY)).expect(401);
    });

    it('refuses a timestamp more than 120 s away from now with a signature only', async () => {
      const stale = signed(BODY, { timestamp: now() - 121 });
      await post(BODY, stale).expect(401);
      const future = signed(BODY, { timestamp: now() + 121 });
      await post(BODY, future).expect(401);
      await post(BODY, signed(BODY, { timestamp: now() - 100 })).expect(204);
    });

    it('refuses a replayed id even with a valid ?secret= (replay is never accepted)', async () => {
      const headers = signed(BODY);
      await post(BODY, headers).expect(204);
      await post(BODY, headers).expect(401);
      await post(BODY, headers, `?secret=${LEGACY_SECRET}`).expect(401);
      expect(markRevoked).toHaveBeenCalledTimes(1);
    });

    it('refuses a seen id alone (other headers missing) even with a valid ?secret=', async () => {
      const headers = signed(BODY);
      await post(BODY, headers).expect(204);
      await post(
        BODY,
        { 'X-Auth-Webhook-Id': headers['X-Auth-Webhook-Id'] ?? '' },
        `?secret=${LEGACY_SECRET}`,
      ).expect(401);
      await post(
        BODY,
        { ...headers, 'X-Auth-Webhook-Signature': 'v1=not-hex' },
        `?secret=${LEGACY_SECRET}`,
      ).expect(401);
      expect(markRevoked).toHaveBeenCalledTimes(1);
    });

    it('accepts again a seen id once the 10 minutes have passed', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        const id = randomUUID();
        await post(BODY, signed(BODY, { id })).expect(204);
        vi.advanceTimersByTime(10 * 60_000);
        await post(BODY, signed(BODY, { id })).expect(204);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not burn an id on an invalid signature', async () => {
      const id = randomUUID();
      await post(BODY, signed(BODY, { id, secrets: [OTHER_SECRET] })).expect(
        401,
      );
      await post(BODY, signed(BODY, { id })).expect(204);
    });

    it('refuses a malformed signature header', async () => {
      const headers = signed(BODY);
      await post(BODY, {
        ...headers,
        'X-Auth-Webhook-Signature': 'v1=not-hex',
      }).expect(401);
      await post(BODY, { ...headers, 'X-Auth-Webhook-Id': 'x' }).expect(401);
    });

    it('treats a flag evaluation failure as "not strict": the legacy path stays open', async () => {
      strict = 'throws';
      await post(BODY, {}, `?secret=${LEGACY_SECRET}`).expect(204);
    });

    it('refuses a repeated ?secret= parameter instead of crashing', async () => {
      await post(
        BODY,
        {},
        `?secret=${LEGACY_SECRET}&secret=${LEGACY_SECRET}`,
      ).expect(401);
    });
  });

  describe('flag auth-webhook-require-signature on (strict)', () => {
    beforeEach(() => {
      strict = true;
    });

    it('accepts a valid signature', async () => {
      await post(BODY, signed(BODY)).expect(204);
    });

    it('refuses the legacy ?secret= alone', async () => {
      await post(BODY, {}, `?secret=${LEGACY_SECRET}`).expect(401);
      expect(markRevoked).not.toHaveBeenCalled();
    });

    it('refuses the legacy ?secret= next to an invalid signature', async () => {
      await post(
        BODY,
        signed(BODY, { secrets: [OTHER_SECRET] }),
        `?secret=${LEGACY_SECRET}`,
      ).expect(401);
    });

    it('refuses a replayed id, even with the legacy secret', async () => {
      const headers = signed(BODY);
      await post(BODY, headers).expect(204);
      await post(BODY, headers).expect(401);
      await post(BODY, headers, `?secret=${LEGACY_SECRET}`).expect(401);
      expect(markRevoked).toHaveBeenCalledTimes(1);
    });
  });

  describe('observability of the legacy path', () => {
    let warned: string[];
    let informed: string[];
    let restores: (() => void)[];

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      warned = [];
      informed = [];
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation((message: unknown) => {
          warned.push(String(message));
        });
      const info = vi
        .spyOn(Logger.prototype, 'log')
        .mockImplementation((message: unknown) => {
          informed.push(String(message));
        });
      restores = [() => warn.mockRestore(), () => info.mockRestore()];
    });

    afterEach(() => {
      restores.forEach((restore) => restore());
      vi.useRealTimers();
    });

    const viaLegacy = (headers: Record<string, string> = {}) =>
      post(BODY, headers, `?secret=${LEGACY_SECRET}`).expect(204);

    const reasons = (): (string | undefined)[] =>
      warned.map((message) => /reason=([a-z-]+)\)/.exec(message)?.[1]);

    it.each([
      ['no-signature-headers', (): Record<string, string> => ({})],
      ['hmac', () => signed(BODY, { secrets: [OTHER_SECRET] })],
      ['window', () => signed(BODY, { timestamp: now() - 500 })],
      [
        'format',
        () => ({ ...signed(BODY), 'X-Auth-Webhook-Signature': 'v1=not-hex' }),
      ],
      ['format', () => ({ 'X-Auth-Webhook-Id': randomUUID() })],
    ])(
      'warns with reason=%s when accepted via the legacy secret',
      async (reason, make) => {
        await viaLegacy(make());
        expect(warned).toHaveLength(1);
        expect(warned[0]).toContain('legacy ?secret=');
        expect(reasons()).toEqual([reason]);
      },
    );

    it('does not warn for a replayed id: refused, not accepted via the legacy secret', async () => {
      const headers = signed(BODY);
      await post(BODY, headers).expect(204);
      await post(BODY, headers, `?secret=${LEGACY_SECRET}`).expect(401);
      expect(warned).toEqual([]);
    });

    it('warns with reason=missing-signing-secret without AUTH_WEBHOOK_SIGNING_SECRET', async () => {
      await app.close();
      delete config.AUTH_WEBHOOK_SIGNING_SECRET;
      await start();
      await viaLegacy(signed(BODY));
      expect(reasons()).toEqual(['missing-signing-secret']);
    });

    it('warns at most once per 5 minutes per reason', async () => {
      await viaLegacy();
      await viaLegacy();
      await viaLegacy(signed(BODY, { secrets: [OTHER_SECRET] }));
      await viaLegacy(signed(BODY, { secrets: [OTHER_SECRET] }));
      expect(reasons()).toEqual(['no-signature-headers', 'hmac']);
      vi.advanceTimersByTime(5 * 60_000 - 1);
      await viaLegacy();
      expect(warned).toHaveLength(2);
      vi.advanceTimersByTime(1);
      await viaLegacy();
      expect(warned).toHaveLength(3);
    });

    it('never logs a secret, a signature or an id', async () => {
      const headers = signed(BODY, { secrets: [OTHER_SECRET] });
      await viaLegacy(headers);
      await post(BODY, signed(BODY)).expect(204);
      const logged = [...warned, ...informed].join('\n');
      for (const value of [
        LEGACY_SECRET,
        SIGNING_SECRET,
        OTHER_SECRET,
        headers['X-Auth-Webhook-Id'] ?? '',
        headers['X-Auth-Webhook-Signature'] ?? '',
      ]) {
        expect(logged).not.toContain(value);
      }
    });

    it('does not warn when a signature is accepted, and informs once per 5 minutes', async () => {
      await post(BODY, signed(BODY)).expect(204);
      await post(BODY, signed(BODY)).expect(204);
      expect(warned).toEqual([]);
      expect(informed).toEqual(['Logout webhook accepted via signature']);
      vi.advanceTimersByTime(5 * 60_000);
      await post(BODY, signed(BODY)).expect(204);
      expect(informed).toHaveLength(2);
    });

    it('does not warn in strict mode, where the legacy secret is refused', async () => {
      strict = true;
      await post(BODY, {}, `?secret=${LEGACY_SECRET}`).expect(401);
      expect(warned).toEqual([]);
    });

    it('does not warn for a refused legacy secret', async () => {
      await post(BODY, {}, '?secret=nope').expect(401);
      expect(warned).toEqual([]);
    });
  });

  it('answers 400 for a body without userId, before any acceptance', async () => {
    await post('{}', signed('{}')).expect(400);
    expect(markRevoked).not.toHaveBeenCalled();
  });
});
