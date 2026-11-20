import { validateEnv } from './validate-env';

const valid: Record<string, string> = {
  NODE_ENV: 'production',
  AUTH_SERVICE_URL: 'https://auth.example.test',
  AUTH_CLIENT_ID: 'home-health',
  AUTH_CLIENT_SECRET: 'client-secret-value',
  AUTH_WEBHOOK_SECRET: 'webhook-secret-value',
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
});
