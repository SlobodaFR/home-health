/** Used outside production only, so local runs and tests need no setup. Rejected in production. */
export const DEV_PSEUDONYM_SECRET =
  'dev-only-pseudonym-secret-not-for-production';
const MIN_SECRET_BYTES = 32;

const REQUIRED = [
  'AUTH_SERVICE_URL',
  'AUTH_CLIENT_ID',
  'AUTH_CLIENT_SECRET',
  'AUTH_WEBHOOK_SECRET',
  'FRONTEND_URL',
  'PUBLIC_BASE_URL',
] as const;

// Public URLs: OAuth redirect_uri, post-login redirect, links handed to API clients.
const HTTPS_IN_PRODUCTION = [
  'AUTH_SERVICE_URL',
  'FRONTEND_URL',
  'PUBLIC_BASE_URL',
] as const;

const SECRETS = ['AUTH_CLIENT_SECRET', 'AUTH_WEBHOOK_SECRET'] as const;
const PLACEHOLDER_SECRET = 'change-me';

/**
 * Environment validation, run once at startup by ConfigModule. Throwing here stops the service
 * before it serves anything with a missing or unsafe configuration (everything in REQUIRED is
 * read with getOrThrow, which would otherwise only fail on the first request).
 */
export function validateEnv(
  env: Record<string, unknown>,
): Record<string, unknown> {
  const production = env.NODE_ENV === 'production';
  const pseudonymSecret =
    typeof env.PSEUDONYM_SECRET === 'string' ? env.PSEUDONYM_SECRET : '';

  for (const variable of REQUIRED) {
    if (typeof env[variable] !== 'string' || env[variable].trim() === '') {
      throw new Error(`${variable} is required`);
    }
  }
  if (env.MAX_PAYLOAD_SIZE !== undefined && env.MAX_PAYLOAD_SIZE !== '') {
    const size = Number(env.MAX_PAYLOAD_SIZE);
    if (!Number.isFinite(size) || size <= 0) {
      throw new Error('MAX_PAYLOAD_SIZE must be a positive number of bytes');
    }
  }
  if (env.PORT !== undefined && env.PORT !== '') {
    const port = Number(env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new Error('PORT must be an integer between 1 and 65535');
    }
  }
  if (env.TRUST_PROXY_HOPS !== undefined && env.TRUST_PROXY_HOPS !== '') {
    const hops = Number(env.TRUST_PROXY_HOPS);
    if (!Number.isInteger(hops) || hops < 0 || hops > 10) {
      throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10');
    }
  }

  if (production) {
    for (const variable of HTTPS_IN_PRODUCTION) {
      assertHttpsUrl(env[variable], variable);
    }
    if (
      Buffer.byteLength(pseudonymSecret, 'utf8') < MIN_SECRET_BYTES ||
      pseudonymSecret === DEV_PSEUDONYM_SECRET
    ) {
      throw new Error(
        `PSEUDONYM_SECRET must be set in production to a random value of at least ${MIN_SECRET_BYTES.toString()} bytes (openssl rand -base64 48)`,
      );
    }
    for (const variable of SECRETS) {
      if (env[variable] === PLACEHOLDER_SECRET) {
        throw new Error(`${variable} must not be the placeholder value`);
      }
    }
  }
  return production
    ? env
    : { ...env, PSEUDONYM_SECRET: pseudonymSecret || DEV_PSEUDONYM_SECRET };
}

function assertHttpsUrl(value: unknown, variable: string): void {
  let url: URL | null = null;
  try {
    url = typeof value === 'string' ? new URL(value) : null;
  } catch {
    url = null;
  }
  if (url?.protocol !== 'https:') {
    throw new Error(`${variable} must be an https:// URL in production`);
  }
}
