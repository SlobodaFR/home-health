import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiKey } from '../../domain/api-key/api-key';
import { ApiKeyRepository } from '../../domain/api-key/api-key.repository';
import { RevokeApiKeyUseCase } from './revoke-api-key.use-case';

function makeRepository(key: ApiKey | null): ApiKeyRepository {
  const rows = new Map<string, ApiKey>();
  if (key) {
    rows.set(key.id, key);
  }
  return {
    findById: (id) => Promise.resolve(rows.get(id) ?? null),
    listByUser: () => Promise.resolve([...rows.values()]),
    listActive: () =>
      Promise.resolve([...rows.values()].filter((k) => k.isActive)),
    save: (apiKey) => {
      rows.set(apiKey.id, apiKey);
      return Promise.resolve();
    },
  };
}

describe('RevokeApiKeyUseCase', () => {
  const key = ApiKey.create({
    id: 'key-1',
    userId: 'user-1',
    label: 'test',
    hashedKey: 'salt:hash',
    createdAt: new Date(),
  });

  it('revokes a key owned by the requesting user', async () => {
    const repository = makeRepository(key);
    const useCase = new RevokeApiKeyUseCase(repository);

    await useCase.execute('user-1', 'key-1');

    const stored = await repository.findById('key-1');
    expect(stored?.isActive).toBe(false);
  });

  it('rejects revoking a key owned by another user', async () => {
    const repository = makeRepository(key);
    const useCase = new RevokeApiKeyUseCase(repository);

    await expect(useCase.execute('someone-else', 'key-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects revoking a key that does not exist', async () => {
    const repository = makeRepository(null);
    const useCase = new RevokeApiKeyUseCase(repository);

    await expect(useCase.execute('user-1', 'missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
