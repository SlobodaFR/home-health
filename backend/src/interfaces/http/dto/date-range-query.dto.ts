import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class DateRangeQueryDto {
  @ApiPropertyOptional({
    description:
      'Inclusive lower bound, compared against the stored date string.',
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Inclusive upper bound, compared against the stored date string.',
  })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Max rows returned (default 100, max 1000).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
