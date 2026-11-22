import type { IncomingMessage, ServerResponse } from 'http';
import { json } from 'express';

export interface RawBodyRequest extends IncomingMessage {
  /** Exact bytes of the body, kept for the home-auth logout webhook only. */
  rawBody?: Buffer;
}

const DISCONNECT_PATH = /^\/api\/auth\/disconnect\/?$/i;

/**
 * `verify` hook of the JSON parser (bodyParser is disabled in main.ts, so Nest's `rawBody: true`
 * does not apply): keeps the bytes the HMAC of the logout webhook is computed on, and only for
 * that route, so ingestion payloads are not retained twice.
 */
export function captureWebhookRawBody(
  req: IncomingMessage,
  _res: ServerResponse,
  buf: Buffer,
): void {
  const path = (req.url ?? '').split('?')[0] ?? '';
  if (DISCONNECT_PATH.test(path)) {
    (req as RawBodyRequest).rawBody = Buffer.from(buf);
  }
}

/** The app-wide JSON parser (limit in bytes), with raw body capture for the logout webhook. */
export function jsonBodyParser(limit: number): ReturnType<typeof json> {
  return json({ limit, verify: captureWebhookRawBody });
}
