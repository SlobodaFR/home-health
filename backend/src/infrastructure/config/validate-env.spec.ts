import { DEV_PSEUDONYM_SECRET, validateEnv } from './validate-env';

const valid: Record<string, string> = {
  NODE_ENV: 'production',
  AUTH_SERVICE_URL: 'https://auth.example.test',
  AUTH_CLIENT_ID: 'home-health',
  AUTH_CLIENT_SECRET: 'client-secret-value',
  AUTH_WEBHOOK_SECRET: 'webhook-secret-value',
  PSEUDONYM_SECRET: 'p'.repeat(48),
  FRONTEND_URL: 'https://health.example.test',
  PUBLIC_BASE_URL: 'https://health.example.test',
};

describe('validateEnv', () => {
  it('accepts a complete production configuration', () => {
    expect(validateEnv(valid)).toEqual(valid);
  });

  it.each([
    'AUTH_SERVICE_URL',
    'AUTH_CLIENT_ID',
    'AUTH_CLIENT_SECRET',
    'AUTH_WEBHOOK_SECRET',
    'FRONTEND_URL',
    'PUBLIC_BASE_URL',
  ])('refuses to start without %s (any environment)', (variable) => {
    const { [variable]: _removed, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow(variable);
    expect(() => validateEnv({ ...rest, NODE_ENV: 'development' })).toThrow(
      variable,
    );
    expect(() => validateEnv({ ...valid, [variable]: '  ' })).toThrow(variable);
  });

  it.each(['AUTH_SERVICE_URL', 'FRONTEND_URL', 'PUBLIC_BASE_URL'])(
    'requires %s to be an https URL in production',
    (variable) => {
      expect(() =>
        validateEnv({ ...valid, [variable]: 'http://insecure.test' }),
      ).toThrow(`${variable} must be an https:// URL in production`);
      expect(() => validateEnv({ ...valid, [variable]: 'not a url' })).toThrow(
        variable,
      );
    },
  );

  it('refuses placeholder secrets in production', () => {
    for (const variable of ['AUTH_CLIENT_SECRET', 'AUTH_WEBHOOK_SECRET']) {
      expect(() => validateEnv({ ...valid, [variable]: 'change-me' })).toThrow(
        variable,
      );
    }
  });

  it('allows http URLs and the example secrets outside production', () => {
    const dev = {
      ...valid,
      NODE_ENV: 'development',
      AUTH_SERVICE_URL: 'http://localhost:3001',
      FRONTEND_URL: 'http://localhost:3000',
      PUBLIC_BASE_URL: 'http://localhost:3000',
      AUTH_CLIENT_SECRET: 'change-me',
      AUTH_WEBHOOK_SECRET: 'change-me',
    };
    expect(validateEnv(dev)).toEqual(dev);
  });

  it('requires a random PSEUDONYM_SECRET of at least 32 bytes in production', () => {
    const { PSEUDONYM_SECRET: _removed, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow('PSEUDONYM_SECRET');
    expect(() => validateEnv({ ...valid, PSEUDONYM_SECRET: 'short' })).toThrow(
      'PSEUDONYM_SECRET',
    );
    expect(() =>
      validateEnv({ ...valid, PSEUDONYM_SECRET: DEV_PSEUDONYM_SECRET }),
    ).toThrow('PSEUDONYM_SECRET');
  });

  it('falls back to a dev-only PSEUDONYM_SECRET outside production', () => {
    const { PSEUDONYM_SECRET: _removed, ...rest } = valid;
    expect(
      validateEnv({ ...rest, NODE_ENV: 'development' }).PSEUDONYM_SECRET,
    ).toBe(DEV_PSEUDONYM_SECRET);
    expect(
      validateEnv({ ...valid, NODE_ENV: 'development' }).PSEUDONYM_SECRET,
    ).toBe(valid.PSEUDONYM_SECRET);
  });

  it('rejects an invalid TRUST_PROXY_HOPS', () => {
    for (const value of ['abc', '-1', '1.5', '99']) {
      expect(() => validateEnv({ ...valid, TRUST_PROXY_HOPS: value })).toThrow(
        'TRUST_PROXY_HOPS',
      );
    }
    expect(validateEnv({ ...valid, TRUST_PROXY_HOPS: '1' })).toBeDefined();
  });

  it('rejects an invalid MAX_PAYLOAD_SIZE or PORT', () => {
    expect(() => validateEnv({ ...valid, MAX_PAYLOAD_SIZE: 'abc' })).toThrow(
      'MAX_PAYLOAD_SIZE',
    );
    expect(() => validateEnv({ ...valid, MAX_PAYLOAD_SIZE: '0' })).toThrow(
      'MAX_PAYLOAD_SIZE',
    );
    expect(() => validateEnv({ ...valid, PORT: '99999' })).toThrow('PORT');
    expect(
      validateEnv({ ...valid, MAX_PAYLOAD_SIZE: '52428800', PORT: '3000' }),
    ).toBeDefined();
  });

  describe('AUTH_WEBHOOK_SIGNING_SECRET (optional, 64 hex)', () => {
    const hex = '0123456789abcdef'.repeat(4);

    it('may be absent or empty: only the legacy webhook secret applies', () => {
      expect(() => validateEnv(valid)).not.toThrow();
      expect(() =>
        validateEnv({ ...valid, AUTH_WEBHOOK_SIGNING_SECRET: '' }),
      ).not.toThrow();
    });

    it('accepts 64 lowercase hexadecimal characters', () => {
      expect(() =>
        validateEnv({ ...valid, AUTH_WEBHOOK_SIGNING_SECRET: hex }),
      ).not.toThrow();
      expect(() =>
        validateEnv({
          ...valid,
          NODE_ENV: 'development',
          AUTH_WEBHOOK_SIGNING_SECRET: hex,
        }),
      ).not.toThrow();
    });

    it.each([
      'change-me',
      hex.slice(1),
      `${hex}0`,
      `${hex.slice(1)}z`,
      hex.toUpperCase(),
      ' ',
    ])('refuses %j (any environment)', (value) => {
      expect(() =>
        validateEnv({ ...valid, AUTH_WEBHOOK_SIGNING_SECRET: value }),
      ).toThrow('AUTH_WEBHOOK_SIGNING_SECRET');
      expect(() =>
        validateEnv({
          ...valid,
          NODE_ENV: 'development',
          AUTH_WEBHOOK_SIGNING_SECRET: value,
        }),
      ).toThrow('AUTH_WEBHOOK_SIGNING_SECRET');
    });
  });
});
