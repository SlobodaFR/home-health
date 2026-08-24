import { Entity } from 'typeorm';
import { MinimalHealthRecordOrmEntity } from './minimal-health-record.orm-entity';

@Entity({ name: 'state_of_mind_entries' })
export class StateOfMindEntryOrmEntity extends MinimalHealthRecordOrmEntity {}
