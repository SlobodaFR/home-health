export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Port (driven side) implemented by the infrastructure layer. Talks to the
 * central auth service (home-auth) using the OAuth2 Authorization Code flow.
 * No user-info fetch: the access token itself (RS256, verified via JWKS)
 * already carries sub/email/name, so there is no local user mirror to keep in sync.
 */
export abstract class OAuthClient {
  abstract authorizeUrl(redirectUri: string): string;
  abstract exchangeCode(code: string, redirectUri: string): Promise<TokenPair>;
  abstract refresh(refreshToken: string): Promise<TokenPair>;
}
