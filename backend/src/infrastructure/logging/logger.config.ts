import type { IncomingMessage, ServerResponse } from 'http';
import type { Params } from 'nestjs-pino';

/**
 * Defense in depth only: pino redaction matches object keys (one level per `*`) and never looks
 * inside message strings. The real control is that log messages never interpolate personal data
 * (use pseudonymize()) and that request/response serializers keep no headers, query or body.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'res.headers.location',
  '*.email',
  '*.token',
  '*.client_secret',
  '*.refresh_token',
  '*.access_token',
];

const QUIET_PATHS = [/^\/assets\//i, /^(\/api)?\/health\/status\/?$/i];

function pathOf(url: string | undefined): string {
  return (url ?? '').split('?')[0];
}

/**
 * The ingestion and read routes carry the user's API key as a path segment
 * (/api/health/:apiKey/...): it is a credential, never log it.
 */
export function maskApiKey(path: string): string {
  // Express routing ignores case and repeated slashes: match the same way, anywhere in the path.
  const normalized = path.replace(/\/{2,}/g, '/');
  if (/^(\/api)?\/health\/status\/?$/i.test(normalized)) {
    return normalized;
  }
  // Unknown sub-path of the status route (a mistyped URL): drop whatever follows.
  const status = normalized.match(/^((?:\/api)?\/health\/status\/)(.+)$/i);
  if (status) {
    return `${status[1]}:rest`;
  }
  return normalized.replace(/(\/health\/)[^/]+/i, '$1:apiKey');
}

/**
 * Whitelist serializer for errors. Nest logs every non-HTTP exception as `{ err }`, and pino's
 * standard serializer copies every enumerable property: a TypeORM QueryFailedError would carry
 * `query`, `parameters` (names, emails, health values) and `driverError` into the logs.
 */
export function serializeError(input: unknown): Record<string, unknown> {
  // pino-http hands custom serializers an error already serialized by pino-std-serializers;
  // the original Error is in `.raw`.
  const value = (input as { raw?: unknown } | null | undefined)?.raw ?? input;
  if (!(value instanceof Error)) {
    return { type: typeof value };
  }
  const code = (value as { code?: unknown }).code;
  return {
    type: value.constructor.name,
    message: value.message,
    stack: value.stack,
    ...(typeof code === 'string' || typeof code === 'number' ? { code } : {}),
  };
}

export function loggerParams(nodeEnv: string | undefined): Params {
  return {
    pinoHttp: {
      level: nodeEnv === 'test' ? 'silent' : 'info',
      redact: REDACT_PATHS,
      serializers: {
        // No headers (cookies, tokens), no query string (webhook secret, OAuth code), no IP,
        // no API key from the path.
        req: (req: IncomingMessage) => ({
          method: req.method,
          // originalUrl: req.url is rewritten inside mounted routers.
          url: maskApiKey(
            pathOf((req as { originalUrl?: string }).originalUrl ?? req.url),
          ),
        }),
        err: serializeError,
        // No headers: Location carries authorization codes, Set-Cookie the session token.
        res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
      },
      autoLogging: {
        ignore: (req: IncomingMessage) =>
          QUIET_PATHS.some((pattern) => pattern.test(pathOf(req.url))),
      },
      customLogLevel: (
        _req: IncomingMessage,
        res: ServerResponse,
        err?: Error,
      ) => {
        if (err || res.statusCode >= 500) {
          return 'error';
        }
        return res.statusCode >= 400 ? 'warn' : 'info';
      },
      transport:
        nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
    },
  };
}
