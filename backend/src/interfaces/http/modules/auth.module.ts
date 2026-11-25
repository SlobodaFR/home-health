import { ConfigService } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InitiateServiceLogoutUseCase } from '../../../application/auth/initiate-service-logout.use-case';
import { AccessTokenVerifier } from '../../../domain/auth/access-token-verifier';
import { OAuthClient } from '../../../domain/auth/oauth-client';
import { FeatureFlags } from '../../../domain/shared/feature-flags';
import { RevokedSessionRepository } from '../../../domain/auth/revoked-session.repository';
import { HttpOAuthClient } from '../../../infrastructure/auth/http-oauth-client';
import { SingleFlightOAuthClient } from '../../../infrastructure/auth/single-flight-oauth-client';
import { JwksAccessTokenVerifier } from '../../../infrastructure/auth/jwks-access-token-verifier';
import { RevokedSessionOrmEntity } from '../../../infrastructure/persistence/entities/revoked-session.orm-entity';
import { TypeOrmRevokedSessionRepository } from '../../../infrastructure/persistence/repositories/typeorm-revoked-session.repository';
import { AuthController } from '../controllers/auth.controller';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([RevokedSessionOrmEntity])],
  controllers: [AuthController],
  providers: [
    {
      provide: RevokedSessionRepository,
      useClass: TypeOrmRevokedSessionRepository,
    },
    {
      provide: OAuthClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new SingleFlightOAuthClient(new HttpOAuthClient(config)),
    },
    { provide: AccessTokenVerifier, useClass: JwksAccessTokenVerifier },
    {
      provide: InitiateServiceLogoutUseCase,
      inject: [FeatureFlags, AccessTokenVerifier, OAuthClient],
      useFactory: (
        flags: FeatureFlags,
        verifier: AccessTokenVerifier,
        oauthClient: OAuthClient,
      ) => new InitiateServiceLogoutUseCase(flags, verifier, oauthClient),
    },
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AccessTokenVerifier],
})
export class AuthModule {}
