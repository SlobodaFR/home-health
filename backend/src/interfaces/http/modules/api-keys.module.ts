import { Module } from '@nestjs/common';
import { CreateApiKeyUseCase } from '../../../application/api-keys/create-api-key.use-case';
import { ListApiKeysUseCase } from '../../../application/api-keys/list-api-keys.use-case';
import { RevokeApiKeyUseCase } from '../../../application/api-keys/revoke-api-key.use-case';
import { ApiKeyRepository } from '../../../domain/api-key/api-key.repository';
import { TypeOrmApiKeyRepository } from '../../../infrastructure/persistence/repositories/typeorm-api-key.repository';
import { ApiKeysController } from '../controllers/api-keys.controller';

@Module({
  controllers: [ApiKeysController],
  providers: [
    { provide: ApiKeyRepository, useClass: TypeOrmApiKeyRepository },
    CreateApiKeyUseCase,
    ListApiKeysUseCase,
    RevokeApiKeyUseCase,
  ],
  exports: [ApiKeyRepository],
})
export class ApiKeysModule {}
