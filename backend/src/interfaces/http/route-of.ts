import type { Request } from 'express';

/**
 * Route template of a request ('/api/health/:apiKey/metrics'), never the raw URL: no path
 * parameter (the API key lives in one), query string or token. Returns null when no Nest route
 * matched. Reads req.route and req.baseUrl only.
 */
export function routeOf(req: Request): string | null {
  const path = (req.route as { path?: unknown } | undefined)?.path;
  return typeof path === 'string' ? `${req.baseUrl}${path}` : null;
}
