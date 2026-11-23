import { createHmac, timingSafeEqual } from 'crypto';

/**
 * home-auth logout webhook signature (contract PC7).
 *
 * Headers: X-Auth-Webhook-Id (uuid v4), X-Auth-Webhook-Timestamp (unix seconds),
 * X-Auth-Webhook-Signature: `v1=<hex>[,v1=<hex>]`, where
 * hex = HMAC-SHA256(secret, `${id}.${timestamp}.${rawBody}`). The key is the secret string as
 * stored (64 hex characters, UTF-8), NOT its decoded bytes; rawBody is the exact bytes received.
 */

const MAX_SKEW_SECONDS = 120;
const MAX_ENTRIES = 5;
const REPLAY_WINDOW_MS = 10 * 60_000;
const MAX_REMEMBERED_IDS = 10_000;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNIX_SECONDS = /^\d{1,12}$/;
const V1_ENTRY = /^v1=([0-9a-f]{64})$/i;

export function computeWebhookSignature(
  secret: string,
  id: string,
  timestamp: string | number,
  rawBody: string | Buffer,
): string {
  return createHmac('sha256', secret)
    .update(`${id}.${String(timestamp)}.`)
    .update(rawBody)
    .digest('hex');
}

export interface WebhookSignatureInput {
  /** AUTH_WEBHOOK_SIGNING_SECRET. */
  secret: string;
  /** X-Auth-Webhook-Id */
  id: string | undefined;
  /** X-Auth-Webhook-Timestamp */
  timestamp: string | undefined;
  /** X-Auth-Webhook-Signature */
  header: string | undefined;
}

export type WebhookSignatureOutcome = 'valid' | 'format' | 'window' | 'hmac';

/**
 * Checks format (before anything else, so a stale and malformed request is `format`), freshness (|floor(now) - timestamp| <= 120 s) and every `v1=` entry (hex decoded to
 * 32 bytes, then timingSafeEqual): valid as soon as one entry matches. Replay detection is the
 * caller's (WebhookReplayCache), once the signature is authentic. The outcome tells why a
 * request was refused (format, window, hmac), for logs: never log the values themselves. Never throws.
 */
export function verifyWebhookSignature(
  input: WebhookSignatureInput,
  rawBody: Buffer | undefined,
  nowMs: number,
): WebhookSignatureOutcome {
  const { secret, id, timestamp, header } = input;
  if (
    !rawBody ||
    !id ||
    !timestamp ||
    !header ||
    !UUID_V4.test(id) ||
    !UNIX_SECONDS.test(timestamp)
  ) {
    return 'format';
  }
  const received = parseV1Entries(header);
  if (!received) {
    return 'format';
  }
  if (
    Math.abs(Math.floor(nowMs / 1000) - Number(timestamp)) > MAX_SKEW_SECONDS
  ) {
    return 'window';
  }
  const expected = createHmac('sha256', secret)
    .update(`${id}.${timestamp}.`)
    .update(rawBody)
    .digest();
  // Every entry is compared (no early exit): the time taken does not depend on which matched.
  let matched = false;
  for (const candidate of received) {
    if (timingSafeEqual(candidate, expected)) {
      matched = true;
    }
  }
  return matched ? 'valid' : 'hmac';
}

/** The `v1=` entries as 32-byte buffers; null if the header is malformed or has no v1 entry. */
function parseV1Entries(header: string): Buffer[] | null {
  const entries = header.split(',').map((entry) => entry.trim());
  if (entries.length > MAX_ENTRIES) {
    return null;
  }
  const decoded: Buffer[] = [];
  for (const entry of entries) {
    if (entry.startsWith('v1=')) {
      const match = V1_ENTRY.exec(entry);
      if (!match?.[1]) {
        return null;
      }
      decoded.push(Buffer.from(match[1], 'hex'));
    } else if (!/^v\d+=\S+$/.test(entry)) {
      // A future version (v2=...) is ignored; anything else is malformed.
      return null;
    }
  }
  return decoded.length > 0 ? decoded : null;
}

/** Webhook ids already accepted in the last 10 minutes (in memory, per process). */
export class WebhookReplayCache {
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly capacity: number = MAX_REMEMBERED_IDS,
  ) {}

  get size(): number {
    return this.seen.size;
  }

  /** True if the id was accepted within the window (read-only: nothing is recorded). */
  has(id: string): boolean {
    this.purge(this.now());
    return this.seen.has(id);
  }

  /** True the first time an id is presented within the window, false for a replay. */
  markSeen(id: string): boolean {
    const now = this.now();
    this.purge(now);
    if (this.seen.has(id)) {
      return false;
    }
    this.seen.set(id, now + REPLAY_WINDOW_MS);
    while (this.seen.size > this.capacity) {
      const oldest = this.seen.keys().next();
      if (oldest.done) {
        break;
      }
      this.seen.delete(oldest.value);
    }
    return true;
  }

  private purge(now: number): void {
    for (const [id, expiresAt] of this.seen) {
      if (expiresAt > now) {
        // Insertion order is expiry order: the rest is still valid.
        break;
      }
      this.seen.delete(id);
    }
  }
}
