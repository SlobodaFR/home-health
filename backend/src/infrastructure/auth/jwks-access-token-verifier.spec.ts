import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { ConfigService } from '@nestjs/config';
import { exportJWK, generateKeyPair, JWK, KeyLike, SignJWT } from 'jose';
import { FeatureFlags } from '../../domain/shared/feature-flags';
import { JwksAccessTokenVerifier } from './jwks-access-token-verifier';

const CLIENT_ID = 'home-health';
const FLAG = 'auth-verify-token-claims';

describe('JwksAccessTokenVerifier', () => {
  let server: Server;
  let issuer: string;
  let privateKey: KeyLike;
  let hsSecret: Uint8Array;
  let jwk: JWK;
  let jwkWithoutAlg: JWK;
  let flagEnabled: boolean;
  const evaluated: [string, boolean][] = [];

  const flags: FeatureFlags = {
    isEnabled: (key, codeDefault) => {
      evaluated.push([key, codeDefault]);
      return Promise.resolve(flagEnabled);
    },
  };

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    const publicJwk = await exportJWK(pair.publicKey);
    jwk = { ...publicJwk, kid: 'k1', alg: 'RS256' };
    // Same key published without `alg`: jose's key selection then accepts any RSA algorithm,
    // so only the `algorithms` option of jwtVerify can refuse a non-RS256 token signed with it.
    jwkWithoutAlg = { ...publicJwk, kid: 'k2' };
    hsSecret = new TextEncoder().encode('x'.repeat(32));
    server = createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ keys: [jwk, jwkWithoutAlg] }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port.toString()}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    flagEnabled = false;
    evaluated.length = 0;
  });

  function verifier(): JwksAccessTokenVerifier {
    const values: Record<string, string> = {
      AUTH_SERVICE_URL: `${issuer}/some/prefix/ignored-by-origin`,
      AUTH_CLIENT_ID: CLIENT_ID,
    };
    const config = {
      getOrThrow: (key: string) => values[key],
    } as unknown as ConfigService;
    return new JwksAccessTokenVerifier(config, flags);
  }

  function claims(
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return { email: 'thomas@example.com', name: 'Thomas', ...extra };
  }

  async function sign(
    options: { aud?: string; iss?: string | null } = {},
    extra: Record<string, unknown> = {},
  ): Promise<string> {
    const jwt = new SignJWT(claims(extra))
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('5m');
    if (options.aud !== undefined) {
      jwt.setAudience(options.aud);
    }
    if (options.iss !== null) {
      jwt.setIssuer(options.iss ?? new URL(issuer).origin);
    }
    return jwt.sign(privateKey);
  }

  /** RS512 token signed with the key published without `alg` (kid k2). */
  async function signRs512(): Promise<string> {
    return new SignJWT(claims())
      .setProtectedHeader({ alg: 'RS512', kid: 'k2' })
      .setSubject('user-1')
      .setIssuedAt()
      .setIssuer(new URL(issuer).origin)
      .setAudience(CLIENT_ID)
      .setExpirationTime('5m')
      .sign(privateKey);
  }

  describe('flag off (code default: current behaviour)', () => {
    it('evaluates auth-verify-token-claims with the code default false', async () => {
      await verifier().verify(await sign({ aud: CLIENT_ID }));
      expect(evaluated).toEqual([[FLAG, false]]);
    });

    it('accepts a valid token', async () => {
      await expect(
        verifier().verify(await sign({ aud: CLIENT_ID })),
      ).resolves.toMatchObject({ sub: 'user-1', email: 'thomas@example.com' });
    });

    it('still accepts another app audience, no audience and a wrong issuer', async () => {
      const v = verifier();
      expect(await v.verify(await sign({ aud: 'home-chat' }))).not.toBeNull();
      expect(await v.verify(await sign({}))).not.toBeNull();
      expect(
        await v.verify(
          await sign({ aud: CLIENT_ID, iss: 'https://evil.example' }),
        ),
      ).not.toBeNull();
    });

    it('still accepts a non-RS256 token signed with a published key (no algorithm check)', async () => {
      expect(await verifier().verify(await signRs512())).not.toBeNull();
    });

    it('rejects a token that is not signed by the JWKS', async () => {
      const forged = await new SignJWT(claims())
        .setProtectedHeader({ alg: 'HS256', kid: 'k1' })
        .setSubject('user-1')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(hsSecret);
      expect(await verifier().verify(forged)).toBeNull();
    });
  });

  describe('flag on (audience, issuer, RS256)', () => {
    beforeEach(() => {
      flagEnabled = true;
    });

    it('accepts a valid token (aud = AUTH_CLIENT_ID, iss = AUTH_SERVICE_URL origin)', async () => {
      await expect(
        verifier().verify(await sign({ aud: CLIENT_ID })),
      ).resolves.toMatchObject({ sub: 'user-1', name: 'Thomas' });
    });

    it('rejects a token issued for another app (aud)', async () => {
      expect(
        await verifier().verify(await sign({ aud: 'home-chat' })),
      ).toBeNull();
    });

    it('rejects a token without audience', async () => {
      expect(await verifier().verify(await sign({}))).toBeNull();
    });

    it('rejects a token with a wrong issuer', async () => {
      expect(
        await verifier().verify(
          await sign({ aud: CLIENT_ID, iss: 'https://evil.example' }),
        ),
      ).toBeNull();
    });

    it('rejects a token without issuer', async () => {
      expect(
        await verifier().verify(await sign({ aud: CLIENT_ID, iss: null })),
      ).toBeNull();
    });

    it('rejects an algorithm other than RS256, even with a key that does not pin one', async () => {
      expect(await verifier().verify(await signRs512())).toBeNull();
    });

    it('still rejects an expired token', async () => {
      const expired = await new SignJWT(claims())
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setSubject('user-1')
        .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
        .setIssuer(new URL(issuer).origin)
        .setAudience(CLIENT_ID)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 300)
        .sign(privateKey);
      expect(await verifier().verify(expired)).toBeNull();
    });
  });

  it('falls back to the current behaviour if flag evaluation throws', async () => {
    const throwing: FeatureFlags = {
      isEnabled: () => Promise.reject(new Error('boom')),
    };
    const base = verifier() as unknown as { config: ConfigService };
    const v = new JwksAccessTokenVerifier(base.config, throwing);
    expect(await v.verify(await sign({ aud: 'home-chat' }))).not.toBeNull();
  });
});
