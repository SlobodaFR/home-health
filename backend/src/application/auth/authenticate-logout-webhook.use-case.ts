import { createHash, timingSafeEqual } from 'crypto';
import { Logger } from '@nestjs/common';
import {
  verifyWebhookSignature,
  WebhookReplayCache,
} from '../../domain/auth/webhook-signature';
import { FeatureFlags } from '../../domain/shared/feature-flags';

/** home-features flag: signature mandatory, the legacy ?secret= is refused. Code default: false. */
export const REQUIRE_SIGNATURE_FLAG = 'auth-webhook-require-signature';

/** One log line per reason (and one for signature acceptances) over this duration. */
export const LOG_THROTTLE_MS = 5 * 60_000;

/** Why an acceptance went through the legacy ?secret= rather than the signature. */
type LegacyReason =
  | 'no-signature-headers'
  | 'missing-signing-secret'
  | 'raw-body-unavailable'
  | 'format'
  | 'window'
  | 'hmac';

export interface LogoutWebhookRequest {
  /** X-Auth-Webhook-Id / -Timestamp / -Signature */
  id?: string;
  timestamp?: string;
  signature?: string;
  /** Exact bytes received; absent if they could not be captured. */
  rawBody?: Buffer;
  /** Legacy shared secret (`?secret=`), whatever the client sent. */
  querySecret?: unknown;
}

/**
 * Authenticates the home-auth logout webhook (contract PC7, double acceptance): valid v1
 * signature, OR the legacy `?secret=` while `auth-webhook-require-signature` is false.
 * - The seen-id check runs first, as soon as the id header is non-empty: an id already accepted
 *   within 10 minutes is refused, even with a valid `?secret=`.
 * - Other signature failures (format, window, hmac) or the impossibility to check it (no signing
 *   secret, raw body missing) fall back to the `?secret=` while the flag is false.
 * - Flag true: only the signature counts; without a signing secret nothing is accepted.
 * Every acceptance is logged (WARN for the `?secret=` with its reason, INFO for the signature),
 * one line per reason every 5 minutes, never writing a secret, a signature or an id.
 */
export class AuthenticateLogoutWebhookUseCase {
  private readonly lastLogged = new Map<string, number>();
  private readonly replayCache: WebhookReplayCache;
  private loggedStrictWithoutSecret = false;

  constructor(
    /** AUTH_WEBHOOK_SIGNING_SECRET, undefined/empty: only the legacy path exists. */
    private readonly signingSecret: string | undefined,
    private readonly legacySecret: string,
    private readonly flags: FeatureFlags,
    private readonly now: () => number = () => Date.now(),
    private readonly logger: Pick<
      Logger,
      'log' | 'warn' | 'error'
    > = new Logger(AuthenticateLogoutWebhookUseCase.name),
  ) {
    this.replayCache = new WebhookReplayCache(now);
  }

  async execute(request: LogoutWebhookRequest): Promise<boolean> {
    const { id, timestamp, signature, rawBody } = request;
    // A replay is refused whatever follows (other headers missing or malformed, valid ?secret=).
    if (this.signingSecret && id && this.replayCache.has(id)) {
      return false;
    }

    let reason: LegacyReason;
    if (!id && !timestamp && !signature) {
      reason = 'no-signature-headers';
    } else if (!this.signingSecret) {
      reason = 'missing-signing-secret';
    } else if (!rawBody) {
      reason = 'raw-body-unavailable';
    } else {
      const outcome = verifyWebhookSignature(
        { secret: this.signingSecret, id, timestamp, header: signature },
        rawBody,
        this.now(),
      );
      if (outcome === 'valid' && id && this.replayCache.markSeen(id)) {
        this.logThrottled('info:signature', () =>
          this.logger.log('Logout webhook accepted via signature'),
        );
        return true;
      }
      reason = outcome === 'valid' ? 'format' : outcome;
    }

    // Non-blocking evaluation (the adapter memoizes); an error means "not strict".
    if (await this.signatureRequired()) {
      if (!this.signingSecret && !this.loggedStrictWithoutSecret) {
        this.loggedStrictWithoutSecret = true;
        this.logger.error(
          `${REQUIRE_SIGNATURE_FLAG} is on but AUTH_WEBHOOK_SIGNING_SECRET is not set: every logout webhook is refused`,
        );
      }
      return false;
    }
    if (!this.matchesLegacySecret(request.querySecret)) {
      return false;
    }
    this.logThrottled(`warn:${reason}`, () =>
      this.logger.warn(
        `Logout webhook accepted via legacy ?secret= (reason=${reason}): not signed correctly`,
      ),
    );
    return true;
  }

  private logThrottled(key: string, write: () => void): void {
    const nowMs = this.now();
    const last = this.lastLogged.get(key);
    if (last !== undefined && nowMs - last < LOG_THROTTLE_MS) {
      return;
    }
    this.lastLogged.set(key, nowMs);
    write();
  }

  private async signatureRequired(): Promise<boolean> {
    try {
      return await this.flags.isEnabled(REQUIRE_SIGNATURE_FLAG, false);
    } catch {
      return false;
    }
  }

  private matchesLegacySecret(candidate: unknown): boolean {
    if (typeof candidate !== 'string' || !this.legacySecret) {
      return false;
    }
    // Digests of equal size: timingSafeEqual requires equal-length inputs.
    return timingSafeEqual(sha256(candidate), sha256(this.legacySecret));
  }
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}
