import { ApiProperty } from '@nestjs/swagger';

export class CreateApiKeyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'iPhone Thomas' })
  label!: string;

  @ApiProperty({
    description:
      'Shown once. Never recoverable afterwards - only a new key can be issued.',
  })
  rawKey!: string;

  @ApiProperty({
    description:
      'Paste as the "Cle" (API key) value in Health Auto Export\'s REST API automation.',
  })
  ingestUrl!: string;

  @ApiProperty({
    description:
      'Base URL home-remote-mcps reads from (GET {readBaseUrl}/metrics, /workouts, ...).',
  })
  readBaseUrl!: string;

  @ApiProperty()
  createdAt!: string;
}
