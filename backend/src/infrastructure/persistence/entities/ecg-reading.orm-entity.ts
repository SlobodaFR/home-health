import { Entity } from 'typeorm';
import { MinimalHealthRecordOrmEntity } from './minimal-health-record.orm-entity';

@Entity({ name: 'ecg_readings' })
export class EcgReadingOrmEntity extends MinimalHealthRecordOrmEntity {}
