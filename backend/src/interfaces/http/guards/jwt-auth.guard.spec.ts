import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
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
  const response = { cookie: jest.fn() };
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

  let verify: jest.Mock;
  let refresh: jest.Mock;
  let getRevokedAt: jest.Mock;
  let guard: JwtAuthGuard;

  beforeEach(() => {
    verify = jest.fn();
    const verifier: AccessTokenVerifier = { verify };

    refresh = jest.fn();
    const oauthClient: OAuthClient = {
      authorizeUrl: jest.fn(),
      exchangeCode: jest.fn(),
      refresh,
    };

    getRevokedAt = jest.fn().mockResolvedValue(null);
    const revokedSessions: RevokedSessionRepository = {
      markRevoked: jest.fn(),
      getRevokedAt,
    };

    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
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
