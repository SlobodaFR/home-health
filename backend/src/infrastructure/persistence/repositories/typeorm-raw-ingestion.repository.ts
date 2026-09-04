import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RawIngestion } from '../../../domain/raw-ingestion/raw-ingestion';
import { RawIngestionRepository } from '../../../domain/raw-ingestion/raw-ingestion.repository';
import { RawIngestionOrmEntity } from '../entities/raw-ingestion.orm-entity';
import { currentManager } from '../typeorm-unit-of-work';

@Injectable()
export class TypeOrmRawIngestionRepository extends RawIngestionRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  // `unknown` -> `any`: arbitrary JSON crossing into the payload column.
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
  async save(entry: RawIngestion): Promise<void> {
    const payload = entry.payload as any;
    await currentManager(this.dataSource).insert(RawIngestionOrmEntity, {
      id: randomUUID(),
      ...entry,
      payload,
    });
  }
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
}
