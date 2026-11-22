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
import { Request, Response } from 'express';
import { AuthenticateLogoutWebhookUseCase } from '../../../application/auth/authenticate-logout-webhook.use-case';
import { OAuthClient } from '../../../domain/auth/oauth-client';
import { RevokedSessionRepository } from '../../../domain/auth/revoked-session.repository';
import { FeatureFlags } from '../../../domain/shared/feature-flags';
import { clearAuthCookies, setAuthCookies } from '../auth-cookies';
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

  @Public()
  @UseGuards(SameOriginGuard)
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearAuthCookies(res);
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
    return new URL(
      '/api/auth/callback',
      this.config.getOrThrow<string>('PUBLIC_BASE_URL'),
    ).toString();
  }
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return typeof value === 'string' ? value : undefined;
}
