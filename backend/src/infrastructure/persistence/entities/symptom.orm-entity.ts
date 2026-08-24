import { Entity } from 'typeorm';
import { MinimalHealthRecordOrmEntity } from './minimal-health-record.orm-entity';

@Entity({ name: 'symptoms' })
export class SymptomOrmEntity extends MinimalHealthRecordOrmEntity {}
