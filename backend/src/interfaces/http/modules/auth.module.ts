import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessTokenVerifier } from '../../../domain/auth/access-token-verifier';
import { OAuthClient } from '../../../domain/auth/oauth-client';
import { RevokedSessionRepository } from '../../../domain/auth/revoked-session.repository';
import { HttpOAuthClient } from '../../../infrastructure/auth/http-oauth-client';
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
    { provide: OAuthClient, useClass: HttpOAuthClient },
    { provide: AccessTokenVerifier, useClass: JwksAccessTokenVerifier },
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AccessTokenVerifier],
})
export class AuthModule {}
