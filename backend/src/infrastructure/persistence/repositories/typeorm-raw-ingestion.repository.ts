import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RawIngestion } from '../../../domain/raw-ingestion/raw-ingestion';
import { RawIngestionRepository } from '../../../domain/raw-ingestion/raw-ingestion.repository';
import { RawIngestionOrmEntity } from '../entities/raw-ingestion.orm-entity';

@Injectable()
export class TypeOrmRawIngestionRepository extends RawIngestionRepository {
  constructor(
    @InjectRepository(RawIngestionOrmEntity)
    private readonly repository: Repository<RawIngestionOrmEntity>,
  ) {
    super();
  }

  // `unknown` -> `any`: arbitrary JSON crossing into the payload column.
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
  async save(entry: RawIngestion): Promise<void> {
    const payload = entry.payload as any;
    await this.repository.insert({ id: randomUUID(), ...entry, payload });
  }
  /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
}
