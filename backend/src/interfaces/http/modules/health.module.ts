import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResolveUserFromApiKeyUseCase } from '../../../application/api-keys/resolve-user-from-api-key.use-case';
import { GetWorkoutUseCase } from '../../../application/health-data/get-workout.use-case';
import { ListHealthMetricsUseCase } from '../../../application/health-data/list-health-metrics.use-case';
import { ListMinimalHealthRecordsUseCase } from '../../../application/health-data/list-minimal-health-records.use-case';
import { ListWorkoutsUseCase } from '../../../application/health-data/list-workouts.use-case';
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
import { HealthReadController } from '../controllers/health-read.controller';
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
  controllers: [HealthIngestionController, HealthReadController],
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
    ListHealthMetricsUseCase,
    ListWorkoutsUseCase,
    GetWorkoutUseCase,
    ListMinimalHealthRecordsUseCase,
    ResolveUserFromApiKeyUseCase,
    ApiKeyGuard,
  ],
})
export class HealthModule {}
