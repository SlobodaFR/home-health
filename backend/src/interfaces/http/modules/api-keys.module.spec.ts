import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ormEntities } from '../../../infrastructure/persistence/entities';
import { serializedTypeOrmRoot } from '../../../test-support/serialized-typeorm';
import { CreateApiKeyUseCase } from '../../../application/api-keys/create-api-key.use-case';
import { ListApiKeysUseCase } from '../../../application/api-keys/list-api-keys.use-case';
import { RevokeApiKeyUseCase } from '../../../application/api-keys/revoke-api-key.use-case';
import { ApiKeyRepository } from '../../../domain/api-key/api-key.repository';
import { ApiKeysModule } from './api-keys.module';

describe('ApiKeysModule', () => {
  it('boots with the real repository and persists a key', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        serializedTypeOrmRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: ormEntities,
          synchronize: true,
        }),
        ApiKeysModule,
      ],
    }).compile();
    await moduleRef.init();

    const created = await moduleRef
      .get(CreateApiKeyUseCase)
      .execute('user-1', 'phone');
    const listed = await moduleRef.get(ListApiKeysUseCase).execute('user-1');
    expect(listed.map((key) => key.id)).toEqual([created.id]);
    expect(await moduleRef.get(ApiKeyRepository).listActive()).toHaveLength(1);

    await moduleRef.get(RevokeApiKeyUseCase).execute('user-1', created.id);
    expect(await moduleRef.get(ApiKeyRepository).listActive()).toHaveLength(0);

    await moduleRef.close();
  });
});
