import {
  computeWebhookSignature,
  verifyWebhookSignature,
  WebhookReplayCache,
} from './webhook-signature';

/**
 * FIXED test vectors (home-auth contract PC7), copied verbatim from home-auth's
 * `webhook-signer.spec.ts`. The key is the secret string itself (its 64 hex characters, UTF-8),
 * NOT its decoded bytes. Cross-check:
 * `printf '%s' '<id>.<timestamp>.<body>' | openssl dgst -sha256 -hmac <secret>`.
 */
const SECRET_1 =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f';
const SECRET_2 =
  'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
const ID_1 = '3b241101-e2bb-4255-8caf-4136c566a962';
const BODY_1 = '{"userId":"u1"}';
const SIG_1_S1 =
  '41294c53497c1d18871786b2d5c3ec091e6b357638e7104d826de50af8813242';
const SIG_1_S2 =
  '89de6c4652b33d864427b3091771ed8b9266a99b3bf915b126eb4655a2dce09f';

describe('webhook signature test vectors (PC7)', () => {
  it('vector 1: HMAC-SHA256(secret, id.timestamp.rawBody)', () => {
    expect(computeWebhookSignature(SECRET_1, ID_1, '1700000000', BODY_1)).toBe(
      SIG_1_S1,
    );
  });

  it('vector 2: another secret, same message', () => {
    expect(computeWebhookSignature(SECRET_2, ID_1, '1700000000', BODY_1)).toBe(
      SIG_1_S2,
    );
  });

  it('vector 3: body hashed as UTF-8 bytes (non-ASCII user id)', () => {
    const body = '{"userId":"4b8f-é"}';
    const id = '9b2f0f6e-8d3a-4f6b-9c1e-2a7d5e4c1b30';
    const expected =
      'd9a2c8cec34058ebb100f8b454ba46b1214cf777000d9aab00dda91205d5a3ac';
    expect(computeWebhookSignature(SECRET_1, id, '1700000123', body)).toBe(
      expected,
    );
    expect(
      computeWebhookSignature(SECRET_1, id, '1700000123', Buffer.from(body)),
    ).toBe(expected);
  });

  it('vector 4: two comma-separated v1= entries are both accepted (overlap)', () => {
    const header = `v1=${SIG_1_S1},v1=${SIG_1_S2}`;
    const now = 1_700_000_000_000;
    expect(
      verifyWebhookSignature(
        { secret: SECRET_1, id: ID_1, timestamp: '1700000000', header },
        Buffer.from(BODY_1),
        now,
      ),
    ).toBe('valid');
    expect(
      verifyWebhookSignature(
        { secret: SECRET_2, id: ID_1, timestamp: '1700000000', header },
        Buffer.from(BODY_1),
        now,
      ),
    ).toBe('valid');
  });
});

describe('verifyWebhookSignature', () => {
  const NOW = 1_700_000_000_000;
  const body = Buffer.from(BODY_1);
  const check = (
    overrides: Partial<{
      secret: string;
      id: string | undefined;
      timestamp: string | undefined;
      header: string | undefined;
    }> = {},
    rawBody: Buffer | null = body,
    now = NOW,
  ) =>
    verifyWebhookSignature(
      {
        secret: SECRET_1,
        id: ID_1,
        timestamp: '1700000000',
        header: `v1=${SIG_1_S1}`,
        ...overrides,
      },
      rawBody ?? undefined,
      now,
    );

  it('accepts a valid signature', () => {
    expect(check()).toBe('valid');
  });

  it('rejects a signature made with another secret', () => {
    expect(check({ header: `v1=${SIG_1_S2}` })).toBe('hmac');
  });

  it('rejects when the body, the id or the timestamp differ from the signed ones', () => {
    expect(check({}, Buffer.from('{"userId":"u2"}'))).toBe('hmac');
    expect(check({ id: '9b2f0f6e-8d3a-4f6b-9c1e-2a7d5e4c1b30' })).toBe('hmac');
    expect(check({ timestamp: '1700000001' })).toBe('hmac');
  });

  it('rejects without raw body (format)', () => {
    expect(check({}, null)).toBe('format');
  });

  it('accepts a timestamp within 120 s of now, on both sides, and rejects beyond', () => {
    const at = (offsetSeconds: number) => {
      const ts = String(1_700_000_000 + offsetSeconds);
      const header = `v1=${computeWebhookSignature(SECRET_1, ID_1, ts, body)}`;
      return check({ timestamp: ts, header });
    };
    expect(at(0)).toBe('valid');
    expect(at(120)).toBe('valid');
    expect(at(-120)).toBe('valid');
    expect(at(121)).toBe('window');
    expect(at(-121)).toBe('window');
  });

  it('counts the window in whole seconds when now is fractional', () => {
    // 120.9 s after the timestamp: 120 whole seconds, still inside the window.
    expect(check({}, body, NOW + 120_900)).toBe('valid');
    expect(check({}, body, NOW + 121_000)).toBe('window');
    expect(check({}, body, NOW - 120_000)).toBe('valid');
    expect(check({}, body, NOW - 121_000)).toBe('window');
  });

  it.each([
    ['missing header', { header: undefined }],
    ['missing id', { id: undefined }],
    ['missing timestamp', { timestamp: undefined }],
    ['empty header', { header: '' }],
    ['no v1 entry', { header: `v2=${SIG_1_S1}` }],
    ['not hex', { header: `v1=${'z'.repeat(64)}` }],
    ['31 bytes', { header: `v1=${SIG_1_S1.slice(2)}` }],
    ['33 bytes', { header: `v1=${SIG_1_S1}00` }],
    ['no version prefix', { header: SIG_1_S1 }],
    [
      'a malformed entry next to a valid one',
      { header: `v1=${SIG_1_S1},v1=xx` },
    ],
    ['an empty entry', { header: `v1=${SIG_1_S1},` }],
    ['id that is not a uuid v4', { id: 'not-a-uuid' }],
    ['timestamp with a fraction', { timestamp: '1700000000.5' }],
    ['timestamp in exponent form', { timestamp: '17e8' }],
    ['negative timestamp', { timestamp: '-1' }],
    [
      'more than 5 entries',
      { header: Array(6).fill(`v1=${SIG_1_S1}`).join(',') },
    ],
  ])('rejects as format: %s', (_label, overrides) => {
    expect(check(overrides)).toBe('format');
  });

  it('ignores entries of another version next to a v1 entry', () => {
    expect(check({ header: `v2=${SIG_1_S2},v1=${SIG_1_S1}` })).toBe('valid');
  });

  it('accepts uppercase hex and spaces around the commas', () => {
    expect(
      check({ header: `v1=${SIG_1_S2} , v1=${SIG_1_S1.toUpperCase()}` }),
    ).toBe('valid');
  });
});

describe('WebhookReplayCache', () => {
  const TEN_MINUTES = 10 * 60_000;

  it('sees an id once, then refuses it for 10 minutes', () => {
    let now = 1_000_000;
    const cache = new WebhookReplayCache(() => now);
    expect(cache.markSeen('a')).toBe(true);
    expect(cache.markSeen('a')).toBe(false);
    now += TEN_MINUTES - 1;
    expect(cache.markSeen('a')).toBe(false);
    expect(cache.markSeen('b')).toBe(true);
  });

  it('has() reads without recording, and honours the 10 minute expiry', () => {
    let now = 1_000_000;
    const cache = new WebhookReplayCache(() => now);
    expect(cache.has('a')).toBe(false);
    expect(cache.markSeen('a')).toBe(true);
    expect(cache.has('a')).toBe(true);
    now += TEN_MINUTES;
    expect(cache.has('a')).toBe(false);
  });

  it('forgets an id after 10 minutes', () => {
    let now = 1_000_000;
    const cache = new WebhookReplayCache(() => now);
    cache.markSeen('a');
    now += TEN_MINUTES;
    expect(cache.markSeen('a')).toBe(true);
  });

  it('stays bounded, dropping the oldest ids first', () => {
    const cache = new WebhookReplayCache(() => 1, 3);
    for (const id of ['a', 'b', 'c', 'd']) {
      cache.markSeen(id);
    }
    expect(cache.size).toBe(3);
    expect(cache.markSeen('a')).toBe(true);
    expect(cache.markSeen('d')).toBe(false);
  });
});
