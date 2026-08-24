import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { ResolveUserFromApiKeyUseCase } from '../../../application/api-keys/resolve-user-from-api-key.use-case';

export interface ApiKeyAuthenticatedRequest extends Request {
  apiKeyUserId?: string;
}

/**
 * Guards /health/:apiKey/*. The key travels in the URL path rather than an
 * Authorization header: Health Auto Export's REST API automation only has a
 * "Cle"/URL field, no way to attach a custom header - same reasoning as
 * home-remote-mcps' ApiKeyGuard for Claude's custom connectors.
 *
 * 404 (not 401) on an unknown/revoked key, so there's no signal distinguishing
 * "wrong key" from "no such route" - avoids helping enumerate valid keys.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly resolveUserFromApiKey: ResolveUserFromApiKeyUseCase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<ApiKeyAuthenticatedRequest>();
    const rawKey = request.params.apiKey;
    if (typeof rawKey !== 'string' || !rawKey) {
      throw new NotFoundException();
    }

    const resolved = await this.resolveUserFromApiKey.execute(rawKey);
    if (!resolved) {
      throw new NotFoundException();
    }

    request.apiKeyUserId = resolved.userId;
    return true;
  }
}
