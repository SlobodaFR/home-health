import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createRemoteJWKSet,
  jwtVerify,
  JWTPayload,
  JWTVerifyOptions,
} from 'jose';
import { AccessTokenPayload } from '../../domain/auth/access-token-payload';
import { AccessTokenVerifier } from '../../domain/auth/access-token-verifier';
import { FeatureFlags } from '../../domain/shared/feature-flags';

/** Flag: verify audience, issuer and algorithm of access tokens (home-auth contract PC3). */
export const VERIFY_TOKEN_CLAIMS_FLAG = 'auth-verify-token-claims';

interface AuthServiceJwtPayload extends JWTPayload {
  email?: string;
  name?: string;
}

/**
 * Verifies access tokens issued by home-auth against its JWKS. With the flag
 * `auth-verify-token-claims` on, the token must also carry this app's audience
 * (AUTH_CLIENT_ID), home-auth's issuer (origin of AUTH_SERVICE_URL) and use RS256.
 * Flag off (code default): signature and expiry only, as before.
 */
@Injectable()
export class JwksAccessTokenVerifier extends AccessTokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly config: ConfigService,
    private readonly flags: FeatureFlags,
  ) {
    super();
    const authServiceUrl = this.config.getOrThrow<string>('AUTH_SERVICE_URL');
    this.jwks = createRemoteJWKSet(
      new URL('/.well-known/jwks.json', authServiceUrl),
    );
  }

  async verify(token: string): Promise<AccessTokenPayload | null> {
    try {
      const { payload } = await jwtVerify<AuthServiceJwtPayload>(
        token,
        this.jwks,
        await this.claimOptions(),
      );
      if (!payload.sub || !payload.email || !payload.name || !payload.iat) {
        return null;
      }
      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        issuedAt: new Date(payload.iat * 1000),
      };
    } catch {
      return null;
    }
  }

  /** Never blocks nor fails verification: the flag memo is served by the adapter. */
  private async claimOptions(): Promise<JWTVerifyOptions | undefined> {
    let enforced = false;
    try {
      enforced = await this.flags.isEnabled(VERIFY_TOKEN_CLAIMS_FLAG, false);
    } catch {
      enforced = false;
    }
    if (!enforced) {
      return undefined;
    }
    return {
      audience: this.config.getOrThrow<string>('AUTH_CLIENT_ID'),
      issuer: new URL(this.config.getOrThrow<string>('AUTH_SERVICE_URL'))
        .origin,
      algorithms: ['RS256'],
    };
  }
}
