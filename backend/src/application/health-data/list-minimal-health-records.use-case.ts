import { Injectable } from '@nestjs/common';
import {
  MinimalHealthRecord,
  MinimalHealthRecordKind,
} from '../../domain/minimal-health-record/minimal-health-record';
import { MinimalHealthRecordRepository } from '../../domain/minimal-health-record/minimal-health-record.repository';
import { DateRangeQuery } from '../../domain/shared/date-range-query';

@Injectable()
export class ListMinimalHealthRecordsUseCase {
  constructor(
    private readonly minimalHealthRecordRepository: MinimalHealthRecordRepository,
  ) {}

  async execute(
    kind: MinimalHealthRecordKind,
    userId: string,
    query: DateRangeQuery,
  ): Promise<MinimalHealthRecord[]> {
    return this.minimalHealthRecordRepository.list(kind, userId, query);
  }
}
