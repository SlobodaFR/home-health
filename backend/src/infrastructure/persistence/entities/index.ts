import { ApiKeyOrmEntity } from './api-key.orm-entity';
import { CycleTrackingEntryOrmEntity } from './cycle-tracking-entry.orm-entity';
import { EcgReadingOrmEntity } from './ecg-reading.orm-entity';
import { HealthMetricOrmEntity } from './health-metric.orm-entity';
import { HeartRateNotificationOrmEntity } from './heart-rate-notification.orm-entity';
import { MedicationEntryOrmEntity } from './medication-entry.orm-entity';
import { RawIngestionOrmEntity } from './raw-ingestion.orm-entity';
import { RevokedSessionOrmEntity } from './revoked-session.orm-entity';
import { StateOfMindEntryOrmEntity } from './state-of-mind-entry.orm-entity';
import { SymptomOrmEntity } from './symptom.orm-entity';
import { WorkoutOrmEntity } from './workout.orm-entity';

export const ormEntities = [
  ApiKeyOrmEntity,
  RevokedSessionOrmEntity,
  RawIngestionOrmEntity,
  HealthMetricOrmEntity,
  WorkoutOrmEntity,
  SymptomOrmEntity,
  EcgReadingOrmEntity,
  HeartRateNotificationOrmEntity,
  StateOfMindEntryOrmEntity,
  CycleTrackingEntryOrmEntity,
  MedicationEntryOrmEntity,
];
