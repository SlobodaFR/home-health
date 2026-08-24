import { ApiKey } from '../../domain/api-key/api-key';
import { ApiKeyRepository } from '../../domain/api-key/api-key.repository';
import { verifySecret } from '../../domain/shared/hash';
import { CreateApiKeyUseCase } from './create-api-key.use-case';

class InMemoryApiKeyRepository extends ApiKeyRepository {
  readonly rows = new Map<string, ApiKey>();

  findById(id: string): Promise<ApiKey | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  listByUser(userId: string): Promise<ApiKey[]> {
    return Promise.resolve(
      [...this.rows.values()].filter((k) => k.userId === userId),
    );
  }

  listActive(): Promise<ApiKey[]> {
    return Promise.resolve([...this.rows.values()].filter((k) => k.isActive));
  }

  save(apiKey: ApiKey): Promise<void> {
    this.rows.set(apiKey.id, apiKey);
    return Promise.resolve();
  }
}

describe('CreateApiKeyUseCase', () => {
  it('issues a key whose raw value verifies against the stored hash', async () => {
    const repository = new InMemoryApiKeyRepository();
    const useCase = new CreateApiKeyUseCase(repository);

    const created = await useCase.execute('user-1', 'iPhone Thomas');

    expect(created.rawKey.startsWith('hh_')).toBe(true);
    const stored = repository.rows.get(created.id);
    expect(stored).toBeDefined();
    expect(verifySecret(created.rawKey, stored!.hashedKey)).toBe(true);
    expect(stored!.userId).toBe('user-1');
  });
});
