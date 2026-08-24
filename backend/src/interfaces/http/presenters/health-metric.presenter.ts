import { ApiProperty } from '@nestjs/swagger';
import { HealthMetric } from '../../../domain/health-metric/health-metric';

export class HealthMetricDto {
  @ApiProperty({
    example: 'step_count',
    description: 'Auto Export metric name.',
  })
  name!: string;

  @ApiProperty({
    example: 'count',
    description: 'Unit for this metric, as reported by Auto Export.',
  })
  units!: string;

  @ApiProperty({
    example: '2026-01-01 08:00:00',
    description: 'Date/time of this data point, as reported by Auto Export.',
  })
  date!: string;

  @ApiProperty({
    example: '',
    description:
      'Data source device/app, empty string when Auto Export omits it.',
  })
  source!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The full Auto Export data point (qty, Min/Avg/Max, systolic/diastolic, value, mealTime, sleep fields, ' +
      '...) - shape varies by metric name, see DESIGN.md §7.',
    example: { qty: 1234, date: '2026-01-01 08:00:00' },
  })
  payload!: unknown;
}

export function toHealthMetricDto(metric: HealthMetric): HealthMetricDto {
  return {
    name: metric.name,
    units: metric.units,
    date: metric.date,
    source: metric.source,
    payload: metric.payload,
  };
}
