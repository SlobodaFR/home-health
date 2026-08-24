import { Entity } from 'typeorm';
import { MinimalHealthRecordOrmEntity } from './minimal-health-record.orm-entity';

@Entity({ name: 'medication_entries' })
export class MedicationEntryOrmEntity extends MinimalHealthRecordOrmEntity {}
