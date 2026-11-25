import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthenticateLogoutWebhookUseCase } from '../../../application/auth/authenticate-logout-webhook.use-case';
import { InitiateServiceLogoutUseCase } from '../../../application/auth/initiate-service-logout.use-case';
import { OAuthClient } from '../../../domain/auth/oauth-client';
import { RevokedSessionRepository } from '../../../domain/auth/revoked-session.repository';
import { FeatureFlags } from '../../../domain/shared/feature-flags';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  LOGOUT_STATE_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  clearAuthCookies,
  clearLogoutStateCookie,
  setAuthCookies,
  setLogoutStateCookie,
} from '../auth-cookies';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { SameOriginGuard } from '../guards/same-origin.guard';
import { SessionRevokedDto } from '../dto/session-revoked.dto';
import { RawBodyRequest } from '../raw-body';

@Controller('auth')
export class AuthController {
  private logoutWebhook?: AuthenticateLogoutWebhookUseCase;

  constructor(
    private readonly oauthClient: OAuthClient,
    private readonly revokedSessionRepository: RevokedSessionRepository,
    private readonly config: ConfigService,
    private readonly flags: FeatureFlags,
    private readonly initiateServiceLogout: InitiateServiceLogoutUseCase,
  ) {}

  @Public()
  @Get('login')
  login(@Res() res: Response): void {
    res.redirect(this.oauthClient.authorizeUrl(this.callbackUrl()));
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Res() res: Response,
  ): Promise<void> {
    const tokens = await this.oauthClient.exchangeCode(
      code,
      this.callbackUrl(),
    );
    setAuthCookies(res, tokens, this.config);
    res.redirect(this.config.getOrThrow<string>('FRONTEND_URL'));
  }

  /**
   * Local logout. Behind `auth-rp-initiated-logout`, also returns the home-auth logout URL (PC10)
   * for the SPA to reach by a top-level navigation; `redirect_to` is null otherwise (local-only).
   * POST + SameOriginGuard: no logout-CSRF. Local cookies are always dropped, the refresh token
   * included (home-auth revokes nothing).
   */
  @Public()
  @UseGuards(SameOriginGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ redirect_to: string | null }> {
    // The body may carry a bearer token hint: never cached.
    res.setHeader('Cache-Control', 'no-store');
    const state = randomBytes(32).toString('base64url');
    let redirectTo: string | null = null;
    try {
      redirectTo = await this.initiateServiceLogout.execute({
        accessToken: cookieValue(req, ACCESS_TOKEN_COOKIE_NAME),
        refreshToken: cookieValue(req, REFRESH_TOKEN_COOKIE_NAME),
        state,
        // Same origin as the registered redirectUri ({PUBLIC_BASE_URL}/api/auth/callback).
        postLogoutRedirectUri: this.publicUrl('/api/auth/logged-out'),
      });
    } catch {
      // Falls back to the local-only logout.
    }
    clearAuthCookies(res);
    if (redirectTo) {
      setLogoutStateCookie(res, state, this.config);
    }
    return { redirect_to: redirectTo };
  }

  /**
   * Return from home-auth after a service-initiated logout. No effect besides dropping the state
   * cookie: the state must match the one stored by POST /auth/logout (missing, repeated or
   * different: neutral landing, no banner). Never starts /authorize.
   */
  @Public()
  @Get('logged-out')
  loggedOut(
    @Query('state') state: unknown,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    res.setHeader('Cache-Control', 'no-store');
    const expected = cookieValue(req, LOGOUT_STATE_COOKIE_NAME);
    const matches =
      typeof state === 'string' &&
      state !== '' &&
      expected !== undefined &&
      timingSafeEqual(sha256(state), sha256(expected));
    clearLogoutStateCookie(res, this.config);
    res.redirect(
      new URL(
        matches ? '/?logged_out=1' : '/',
        this.config.getOrThrow<string>('FRONTEND_URL'),
      ).toString(),
    );
  }

  @Get('me')
  me(@CurrentUser() user: CurrentUserPayload): { user: CurrentUserPayload } {
    return { user };
  }

  /**
   * Webhook called by home-auth on global logout (logoutWebhookUrl). Contract PC7, double
   * acceptance: a valid signature (AUTH_WEBHOOK_SIGNING_SECRET) OR the legacy ?secret=
   * (AUTH_WEBHOOK_SECRET), the latter refused once the flag auth-webhook-require-signature is on.
   * A replayed signature id is always refused (see AuthenticateLogoutWebhookUseCase).
   */
  @Public()
  @ApiQuery({ name: 'secret', required: false, type: String, deprecated: true })
  @Post('disconnect')
  @HttpCode(204)
  async disconnect(
    @Body() dto: SessionRevokedDto,
    @Req() req: Request,
    @Query('secret') secret?: unknown,
  ): Promise<void> {
    const authentic = await this.logoutWebhookAuthenticator().execute({
      id: header(req, 'x-auth-webhook-id'),
      timestamp: header(req, 'x-auth-webhook-timestamp'),
      signature: header(req, 'x-auth-webhook-signature'),
      rawBody: (req as RawBodyRequest & Request).rawBody,
      querySecret: secret,
    });
    if (!authentic) {
      throw new UnauthorizedException();
    }
    await this.revokedSessionRepository.markRevoked(dto.userId, new Date());
  }

  /** Built on first use (it keeps the seen ids and the log throttle), from the validated env. */
  private logoutWebhookAuthenticator(): AuthenticateLogoutWebhookUseCase {
    this.logoutWebhook ??= new AuthenticateLogoutWebhookUseCase(
      this.config.get<string>('AUTH_WEBHOOK_SIGNING_SECRET'),
      this.config.getOrThrow<string>('AUTH_WEBHOOK_SECRET'),
      this.flags,
    );
    return this.logoutWebhook;
  }

  private callbackUrl(): string {
    return this.publicUrl('/api/auth/callback');
  }

  private publicUrl(path: string): string {
    return new URL(
      path,
      this.config.getOrThrow<string>('PUBLIC_BASE_URL'),
    ).toString();
  }
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === 'string' ? value : undefined;
}

function cookieValue(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
