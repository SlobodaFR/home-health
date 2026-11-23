import { randomUUID } from 'crypto';
import { computeWebhookSignature } from '../../domain/auth/webhook-signature';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import {
  AuthenticateLogoutWebhookUseCase,
  LOG_THROTTLE_MS,
  LogoutWebhookRequest,
  REQUIRE_SIGNATURE_FLAG,
} from './authenticate-logout-webhook.use-case';

const SIGNING_SECRET =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const OTHER_SECRET =
  'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
const LEGACY = 'legacy-query-secret';
const BODY = Buffer.from('{"userId":"u1"}');
const START = 1_700_000_000_000;

describe('AuthenticateLogoutWebhookUseCase', () => {
  let nowMs: number;
  let strict: boolean | 'throws';
  let flagCalls: [string, boolean][];
  let warned: string[];
  let informed: string[];
  let errored: string[];

  const flags: FeatureFlags = {
    isEnabled: (key, codeDefault) => {
      flagCalls.push([key, codeDefault]);
      return strict === 'throws'
        ? Promise.reject(new Error('flags down'))
        : Promise.resolve(strict);
    },
  };

  const make = (signingSecret: string | null = SIGNING_SECRET) =>
    new AuthenticateLogoutWebhookUseCase(
      signingSecret ?? undefined,
      LEGACY,
      flags,
      () => nowMs,
      {
        log: (m: unknown) => void informed.push(String(m)),
        warn: (m: unknown) => void warned.push(String(m)),
        error: (m: unknown) => void errored.push(String(m)),
      },
    );

  function signed(
    options: { id?: string; secret?: string; timestampMs?: number } = {},
  ): Pick<LogoutWebhookRequest, 'id' | 'timestamp' | 'signature' | 'rawBody'> {
    const id = options.id ?? randomUUID();
    const timestamp = String(Math.floor((options.timestampMs ?? nowMs) / 1000));
    return {
      id,
      timestamp,
      signature: `v1=${computeWebhookSignature(options.secret ?? SIGNING_SECRET, id, timestamp, BODY)}`,
      rawBody: BODY,
    };
  }

  const reasons = (): (string | undefined)[] =>
    warned.map((message) => /reason=([a-z-]+)\)/.exec(message)?.[1]);

  beforeEach(() => {
    nowMs = START;
    strict = false;
    flagCalls = [];
    warned = [];
    informed = [];
    errored = [];
  });

  it('accepts a valid signature without reading the flag', async () => {
    expect(await make().execute(signed())).toBe(true);
    expect(flagCalls).toEqual([]);
  });

  it('refuses a replayed id even with a valid ?secret=', async () => {
    const useCase = make();
    const request = signed();
    expect(await useCase.execute(request)).toBe(true);
    expect(await useCase.execute(request)).toBe(false);
    expect(await useCase.execute({ ...request, querySecret: LEGACY })).toBe(
      false,
    );
    expect(warned).toEqual([]);
  });

  it('refuses a lone seen id (no timestamp, no signature, no raw body) even with a valid ?secret=', async () => {
    const useCase = make();
    const request = signed();
    await useCase.execute(request);
    expect(await useCase.execute({ id: request.id, querySecret: LEGACY })).toBe(
      false,
    );
    expect(
      await useCase.execute({
        id: request.id,
        timestamp: 'x',
        signature: 'garbage',
        rawBody: BODY,
        querySecret: LEGACY,
      }),
    ).toBe(false);
    expect(warned).toEqual([]);
  });

  it('checks the seen id before the flag is read', async () => {
    const useCase = make();
    const request = signed();
    await useCase.execute(request);
    await useCase.execute({ ...request, querySecret: LEGACY });
    expect(flagCalls).toEqual([]);
  });

  it('forgets an id after 10 minutes', async () => {
    const useCase = make();
    const request = signed();
    await useCase.execute(request);
    nowMs += 10 * 60_000;
    expect(await useCase.execute(signed({ id: request.id }))).toBe(true);
  });

  it('records the id only once the signature verified', async () => {
    const useCase = make();
    const id = randomUUID();
    expect(
      await useCase.execute({
        ...signed({ id, secret: OTHER_SECRET }),
        querySecret: LEGACY,
      }),
    ).toBe(true);
    expect(await useCase.execute(signed({ id }))).toBe(true);
  });

  it('without signature headers: legacy secret, flag asked with default false', async () => {
    expect(await make().execute({ querySecret: LEGACY })).toBe(true);
    expect(flagCalls).toEqual([[REQUIRE_SIGNATURE_FLAG, false]]);
    expect(await make().execute({ querySecret: 'nope' })).toBe(false);
    expect(await make().execute({})).toBe(false);
    expect(await make().execute({ querySecret: ['a'] })).toBe(false);
  });

  it.each<
    [string, (useCase: AuthenticateLogoutWebhookUseCase) => Promise<boolean>]
  >([
    ['no-signature-headers', (u) => u.execute({ querySecret: LEGACY })],
    [
      'hmac',
      (u) =>
        u.execute({ ...signed({ secret: OTHER_SECRET }), querySecret: LEGACY }),
    ],
    [
      'window',
      (u) =>
        u.execute({
          ...signed({ timestampMs: START - 500_000 }),
          querySecret: LEGACY,
        }),
    ],
    [
      'format',
      (u) =>
        u.execute({
          ...signed(),
          signature: 'v1=not-hex',
          querySecret: LEGACY,
        }),
    ],
    [
      'format',
      (u) =>
        u.execute({ id: randomUUID(), rawBody: BODY, querySecret: LEGACY }),
    ],
    [
      'format',
      (u) =>
        u.execute({ signature: 'v1=00', rawBody: BODY, querySecret: LEGACY }),
    ],
    [
      'raw-body-unavailable',
      (u) =>
        u.execute({ ...signed(), rawBody: undefined, querySecret: LEGACY }),
    ],
  ])(
    'warns with reason=%s when accepted via the legacy secret',
    async (reason, run) => {
      expect(await run(make())).toBe(true);
      expect(reasons()).toEqual([reason]);
      expect(warned[0]).toContain('legacy ?secret=');
      expect(informed).toEqual([]);
    },
  );

  it('warns with reason=missing-signing-secret when headers are present but no signing secret exists', async () => {
    expect(await make('').execute({ ...signed(), querySecret: LEGACY })).toBe(
      true,
    );
    expect(reasons()).toEqual(['missing-signing-secret']);
  });

  it('without a signing secret and without headers the reason is no-signature-headers', async () => {
    await make(null).execute({ querySecret: LEGACY });
    expect(reasons()).toEqual(['no-signature-headers']);
  });

  it('strict flag: signature only, the legacy secret is refused without a warning', async () => {
    strict = true;
    const useCase = make();
    expect(await useCase.execute({ querySecret: LEGACY })).toBe(false);
    expect(
      await useCase.execute({
        ...signed({ secret: OTHER_SECRET }),
        querySecret: LEGACY,
      }),
    ).toBe(false);
    expect(await useCase.execute(signed())).toBe(true);
    expect(warned).toEqual([]);
  });

  it('strict flag without signing secret fails closed and logs the error once', async () => {
    strict = true;
    const useCase = make(null);
    expect(await useCase.execute({ querySecret: LEGACY })).toBe(false);
    expect(await useCase.execute({ ...signed(), querySecret: LEGACY })).toBe(
      false,
    );
    expect(errored).toHaveLength(1);
    expect(errored[0]).toContain('AUTH_WEBHOOK_SIGNING_SECRET');
  });

  it('a flag evaluation failure means not strict', async () => {
    strict = 'throws';
    expect(await make().execute({ querySecret: LEGACY })).toBe(true);
  });

  it('throttles one WARN per reason per 5 minutes on the injected clock', async () => {
    const useCase = make();
    await useCase.execute({ querySecret: LEGACY });
    await useCase.execute({ querySecret: LEGACY });
    await useCase.execute({
      ...signed({ secret: OTHER_SECRET }),
      querySecret: LEGACY,
    });
    await useCase.execute({
      ...signed({ secret: OTHER_SECRET }),
      querySecret: LEGACY,
    });
    expect(reasons()).toEqual(['no-signature-headers', 'hmac']);
    nowMs += LOG_THROTTLE_MS - 1;
    await useCase.execute({ querySecret: LEGACY });
    expect(warned).toHaveLength(2);
    nowMs += 1;
    await useCase.execute({ querySecret: LEGACY });
    expect(warned).toHaveLength(3);
  });

  it('logs INFO for signature acceptances under its own throttle key', async () => {
    const useCase = make();
    await useCase.execute(signed());
    await useCase.execute(signed());
    expect(informed).toEqual(['Logout webhook accepted via signature']);
    expect(warned).toEqual([]);
    nowMs += LOG_THROTTLE_MS;
    await useCase.execute(signed());
    expect(informed).toHaveLength(2);
  });

  it('never logs a secret, a signature or an id', async () => {
    const useCase = make();
    const bad = signed({ secret: OTHER_SECRET });
    await useCase.execute({ ...bad, querySecret: LEGACY });
    const good = signed();
    await useCase.execute(good);
    const logged = [...warned, ...informed, ...errored].join('\n');
    for (const value of [
      LEGACY,
      SIGNING_SECRET,
      OTHER_SECRET,
      bad.id,
      bad.signature,
      good.id,
      good.signature,
    ]) {
      expect(logged).not.toContain(value ?? '');
    }
  });
});
