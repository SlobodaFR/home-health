import { ApiProperty } from '@nestjs/swagger';

export class IngestResponseDto {
  @ApiProperty({
    example: ['metrics', 'workouts'],
    description: 'Top-level data types found in this payload and stored.',
  })
  received!: string[];
}
