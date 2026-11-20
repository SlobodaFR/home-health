import { minutes, ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * HTTP rate limit, applied by the global ThrottlerGuard to every route.
 *
 * - Keyed on req.ip, resolved through `trust proxy` (see main.ts). IPv6 clients are grouped by
 *   /64 (throttler default), so rotating addresses inside one allocation does not bypass it.
 * - Budgets are per route and per IP (the default key includes the controller and handler).
 * - In-memory storage: counters reset on restart, fine for a single instance.
 */
export const THROTTLE_ERROR_MESSAGE =
  'Trop de tentatives, réessayez plus tard.';

export const DEFAULT_LIMIT_PER_MINUTE = 100;

/**
 * Device ingestion (Health Auto Export): a first sync or a "Batch Requests" run legitimately
 * sends many POSTs in a short time from one IP, so it gets a much larger budget than the
 * interactive routes. Still bounded (the API key is in the URL, so it can be probed).
 */
export const INGESTION_LIMIT_PER_MINUTE = 600;

export const throttlerOptions: ThrottlerModuleOptions = {
  errorMessage: THROTTLE_ERROR_MESSAGE,
  ipv6SubnetPrefix: 64,
  throttlers: [{ ttl: minutes(1), limit: DEFAULT_LIMIT_PER_MINUTE }],
};

/** Argument of `@Throttle(...)` for the ingestion route. */
export const ingestionThrottle = {
  default: { ttl: minutes(1), limit: INGESTION_LIMIT_PER_MINUTE },
};
