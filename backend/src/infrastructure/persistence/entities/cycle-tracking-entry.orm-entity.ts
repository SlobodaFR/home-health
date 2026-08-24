import { Entity } from 'typeorm';
import { MinimalHealthRecordOrmEntity } from './minimal-health-record.orm-entity';

@Entity({ name: 'cycle_tracking_entries' })
export class CycleTrackingEntryOrmEntity extends MinimalHealthRecordOrmEntity {}
