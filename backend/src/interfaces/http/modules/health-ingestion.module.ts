import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResolveUserFromApiKeyUseCase } from '../../../application/api-keys/resolve-user-from-api-key.use-case';
import { IngestHealthDataUseCase } from '../../../application/ingestion/ingest-health-data.use-case';
import { HealthMetricRepository } from '../../../domain/health-metric/health-metric.repository';
import { MinimalHealthRecordRepository } from '../../../domain/minimal-health-record/minimal-health-record.repository';
import { RawIngestionRepository } from '../../../domain/raw-ingestion/raw-ingestion.repository';
import { WorkoutRepository } from '../../../domain/workout/workout.repository';
import { ormEntities } from '../../../infrastructure/persistence/entities';
import { TypeOrmHealthMetricRepository } from '../../../infrastructure/persistence/repositories/typeorm-health-metric.repository';
import { TypeOrmMinimalHealthRecordRepository } from '../../../infrastructure/persistence/repositories/typeorm-minimal-health-record.repository';
import { TypeOrmRawIngestionRepository } from '../../../infrastructure/persistence/repositories/typeorm-raw-ingestion.repository';
import { TypeOrmWorkoutRepository } from '../../../infrastructure/persistence/repositories/typeorm-workout.repository';
import { HealthIngestionController } from '../controllers/health-ingestion.controller';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ApiKeysModule } from './api-keys.module';

@Module({
  imports: [
    // The six minimal-record entities aren't directly @InjectRepository()'d
    // (TypeOrmMinimalHealthRecordRepository resolves them dynamically from
    // DataSource by kind), but forFeature must still know about them for
    // DataSource.getRepository() to find their metadata.
    TypeOrmModule.forFeature(ormEntities),
    ApiKeysModule,
  ],
  controllers: [HealthIngestionController],
  providers: [
    {
      provide: RawIngestionRepository,
      useClass: TypeOrmRawIngestionRepository,
    },
    {
      provide: HealthMetricRepository,
      useClass: TypeOrmHealthMetricRepository,
    },
    { provide: WorkoutRepository, useClass: TypeOrmWorkoutRepository },
    {
      provide: MinimalHealthRecordRepository,
      useClass: TypeOrmMinimalHealthRecordRepository,
    },
    IngestHealthDataUseCase,
    ResolveUserFromApiKeyUseCase,
    ApiKeyGuard,
  ],
})
export class HealthIngestionModule {}
