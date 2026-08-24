import { ApiProperty } from '@nestjs/swagger';
import { ApiKey } from '../../../domain/api-key/api-key';

export class ApiKeyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'iPhone Thomas' })
  label!: string;

  @ApiProperty({ nullable: true, example: null })
  lastUsedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ nullable: true, example: null })
  revokedAt!: string | null;
}

/** Never exposes hashedKey. */
export function toApiKeyDto(apiKey: ApiKey): ApiKeyDto {
  return {
    id: apiKey.id,
    label: apiKey.label,
    lastUsedAt: apiKey.lastUsedAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
    revokedAt: apiKey.revokedAt?.toISOString() ?? null,
  };
}
