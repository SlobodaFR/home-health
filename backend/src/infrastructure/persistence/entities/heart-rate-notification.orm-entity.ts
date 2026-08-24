import { Entity } from 'typeorm';
import { MinimalHealthRecordOrmEntity } from './minimal-health-record.orm-entity';

@Entity({ name: 'heart_rate_notifications' })
export class HeartRateNotificationOrmEntity extends MinimalHealthRecordOrmEntity {}
