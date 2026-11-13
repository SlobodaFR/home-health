import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Mock } from 'vitest';
import { AccessTokenPayload } from '../../../domain/auth/access-token-payload';
import { AccessTokenVerifier } from '../../../domain/auth/access-token-verifier';
import { OAuthClient, TokenPair } from '../../../domain/auth/oauth-client';
import { RevokedSessionRepository } from '../../../domain/auth/revoked-session.repository';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  JwtAuthGuard,
} from './jwt-auth.guard';

function makeContext(
  cookies: Record<string, string | undefined>,
): ExecutionContext {
  const request = { cookies, headers: {} };
  const response = { cookie: vi.fn() };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  const validPayload: AccessTokenPayload = {
    sub: 'user-1',
    email: 'thomas@example.com',
    name: 'Thomas',
    issuedAt: new Date('2026-01-01T00:00:00Z'),
  };
  const tokens: TokenPair = {
    accessToken: 'new-access',
    refreshToken: 'new-refresh',
    expiresIn: 3600,
  };

  let verify: Mock;
  let refresh: Mock;
  let getRevokedAt: Mock;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    verify = vi.fn();
    const verifier: AccessTokenVerifier = { verify };

    refresh = vi.fn();
    const oauthClient: OAuthClient = {
      authorizeUrl: vi.fn(),
      exchangeCode: vi.fn(),
      refresh,
    };

    getRevokedAt = vi.fn().mockResolvedValue(null);
    const revokedSessions: RevokedSessionRepository = {
      markRevoked: vi.fn(),
      getRevokedAt,
    };

    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const config = new ConfigService({ NODE_ENV: 'test' });
    guard = new JwtAuthGuard(
      verifier,
      oauthClient,
      revokedSessions,
      config,
      reflector,
    );
  });

  it('allows a request with a valid, non-revoked access token cookie', async () => {
    verify.mockResolvedValue(validPayload);
    const context = makeContext({ [ACCESS_TOKEN_COOKIE_NAME]: 'valid-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a session revoked after the token was issued', async () => {
    verify.mockResolvedValue(validPayload);
    getRevokedAt.mockResolvedValue(new Date('2026-06-01T00:00:00Z'));
    const context = makeContext({ [ACCESS_TOKEN_COOKIE_NAME]: 'valid-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refreshes an expired access token using the refresh token cookie', async () => {
    verify.mockResolvedValue(validPayload);
    refresh.mockResolvedValue(tokens);
    const context = makeContext({ [REFRESH_TOKEN_COOKIE_NAME]: 'old-refresh' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(refresh).toHaveBeenCalledWith('old-refresh');
  });

  it('rejects when neither cookie is present', async () => {
    const context = makeContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
