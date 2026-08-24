import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { DateRangeQueryDto } from './date-range-query.dto';

export class ListHealthMetricsQueryDto extends DateRangeQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter to a single metric name (e.g. step_count, heart_rate).',
  })
  @IsOptional()
  @IsString()
  name?: string;
}
