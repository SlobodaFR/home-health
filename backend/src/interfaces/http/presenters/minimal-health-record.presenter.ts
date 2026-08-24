import { ApiProperty } from '@nestjs/swagger';
import { MinimalHealthRecord } from '../../../domain/minimal-health-record/minimal-health-record';

export class MinimalHealthRecordDto {
  @ApiProperty({
    example: '2026-01-01',
    description:
      'Best-effort date (date/startDate/endDate as reported by Auto Export), may be empty.',
  })
  date!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Raw Auto Export item - format is not publicly documented, see DESIGN.md §12.',
  })
  payload!: unknown;
}

export function toMinimalHealthRecordDto(
  record: MinimalHealthRecord,
): MinimalHealthRecordDto {
  return { date: record.date, payload: record.payload };
}
