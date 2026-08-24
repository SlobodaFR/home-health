import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyAuthenticatedRequest } from '../guards/api-key.guard';

/** The userId resolved by ApiKeyGuard from the :apiKey path param. */
export const ApiKeyUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<ApiKeyAuthenticatedRequest>();
    if (!request.apiKeyUserId) {
      throw new Error(
        '@ApiKeyUser() used on a route not protected by ApiKeyGuard',
      );
    }
    return request.apiKeyUserId;
  },
);
