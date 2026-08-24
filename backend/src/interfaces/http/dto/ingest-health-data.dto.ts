import { Type } from 'class-transformer';
import { IsArray, IsObject, IsOptional, ValidateNested } from 'class-validator';

/**
 * Validates only the envelope shape: `data` must be present, and each known
 * top-level key must be an array if present. Item-level detail (metric data
 * points, workout fields, and the six undocumented types) is intentionally
 * NOT deep-validated here - see DESIGN.md §7 and §12. The controller reads
 * the raw request body (not this DTO) to extract and store that detail
 * losslessly, since class-validator's whitelist would otherwise strip
 * unrecognized fields.
 */
export class AutoExportDataDto {
  @IsArray()
  @IsOptional()
  metrics?: unknown[];

  @IsArray()
  @IsOptional()
  workouts?: unknown[];

  @IsArray()
  @IsOptional()
  symptoms?: unknown[];

  @IsArray()
  @IsOptional()
  ecg?: unknown[];

  @IsArray()
  @IsOptional()
  heartRateNotifications?: unknown[];

  @IsArray()
  @IsOptional()
  stateOfMind?: unknown[];

  @IsArray()
  @IsOptional()
  cycleTracking?: unknown[];

  @IsArray()
  @IsOptional()
  medications?: unknown[];
}

export class AutoExportPayloadDto {
  @IsObject()
  @ValidateNested()
  @Type(() => AutoExportDataDto)
  data!: AutoExportDataDto;
}
