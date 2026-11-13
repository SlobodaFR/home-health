import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { ResolveUserFromApiKeyUseCase } from '../../../application/api-keys/resolve-user-from-api-key.use-case';
import { ApiKeyAuthenticatedRequest, ApiKeyGuard } from './api-key.guard';

function makeContext(apiKey: string | undefined): ExecutionContext {
  const request: Partial<ApiKeyAuthenticatedRequest> = {
    params: apiKey === undefined ? {} : { apiKey },
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  it('resolves the user and attaches apiKeyUserId when the key is active', async () => {
    const execute = vi.fn().mockResolvedValue({ userId: 'user-1' });
    const guard = new ApiKeyGuard({
      execute,
    } as unknown as ResolveUserFromApiKeyUseCase);
    const context = makeContext('hh_valid');
    const request = context
      .switchToHttp()
      .getRequest<ApiKeyAuthenticatedRequest>();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.apiKeyUserId).toBe('user-1');
    expect(execute).toHaveBeenCalledWith('hh_valid');
  });

  it('throws 404 (not 401) for an unknown or revoked key', async () => {
    const execute = vi.fn().mockResolvedValue(null);
    const guard = new ApiKeyGuard({
      execute,
    } as unknown as ResolveUserFromApiKeyUseCase);

    await expect(guard.canActivate(makeContext('hh_wrong'))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws 404 when no apiKey path param is present', async () => {
    const execute = vi.fn();
    const guard = new ApiKeyGuard({
      execute,
    } as unknown as ResolveUserFromApiKeyUseCase);

    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(
      NotFoundException,
    );
    expect(execute).not.toHaveBeenCalled();
  });
});
