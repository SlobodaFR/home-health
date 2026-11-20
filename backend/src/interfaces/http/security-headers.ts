import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

/**
 * Security headers for every response: API, SPA static files. The SPA is self-contained (Vite
 * bundle, system fonts, no third-party script, no analytics, no websocket), so the CSP is
 * `'self'` only. The ingestion/read URLs carry the API key in their path: never leak it
 * through Referer.
 */
export function applySecurityHeaders(app: NestExpressApplication): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Express routing is case-insensitive: match the same way.
    const path = req.path.toLowerCase();
    const isDocs = path === '/docs' || path.startsWith('/docs/');
    (isDocs ? withoutCsp : strict)(req, res, next);
  });
}

const COMMON = {
  strictTransportSecurity: { maxAge: 31_536_000, includeSubDomains: true }, // no preload: hard to undo
  frameguard: { action: 'deny' as const },
  referrerPolicy: { policy: 'no-referrer' as const },
};

const strict = helmet({
  ...COMMON,
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
});

// Swagger UI needs inline scripts; /docs is not served in production.
const withoutCsp = helmet({ ...COMMON, contentSecurityPolicy: false });
