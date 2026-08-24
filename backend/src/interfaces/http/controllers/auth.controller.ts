import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { OAuthClient } from '../../../domain/auth/oauth-client';
import { RevokedSessionRepository } from '../../../domain/auth/revoked-session.repository';
import { clearAuthCookies, setAuthCookies } from '../auth-cookies';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { SessionRevokedDto } from '../dto/session-revoked.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly oauthClient: OAuthClient,
    private readonly revokedSessionRepository: RevokedSessionRepository,
    private readonly config: ConfigService,
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
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearAuthCookies(res);
  }

  @Get('me')
  me(@CurrentUser() user: CurrentUserPayload): { user: CurrentUserPayload } {
    return { user };
  }

  /** Webhook called by home-auth on global logout (logoutWebhookUrl). */
  @Public()
  @Post('disconnect')
  @HttpCode(204)
  async disconnect(
    @Body() dto: SessionRevokedDto,
    @Query('secret') secret?: string,
  ): Promise<void> {
    if (secret !== this.config.getOrThrow<string>('AUTH_WEBHOOK_SECRET')) {
      throw new UnauthorizedException();
    }
    await this.revokedSessionRepository.markRevoked(dto.userId, new Date());
  }

  private callbackUrl(): string {
    return new URL(
      '/auth/callback',
      this.config.getOrThrow<string>('PUBLIC_BASE_URL'),
    ).toString();
  }
}
