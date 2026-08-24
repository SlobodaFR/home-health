import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/** Upserted on `id` - the Auto Export v2 workout id, or a deterministic hash of (userId, name, start) for v1 payloads. */
@Entity({ name: 'workouts' })
export class WorkoutOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Index()
  @Column({ type: 'text', name: 'user_id' })
  userId!: string;

  @Column('text')
  name!: string;

  @Index()
  @Column('text')
  start!: string;

  @Column('text')
  end!: string;

  @Column('int')
  duration!: number;

  @Column({ type: 'text', nullable: true })
  location!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  energy!: unknown;

  @Column({ type: 'simple-json', name: 'distance_speed', nullable: true })
  distanceSpeed!: unknown;

  @Column({ type: 'simple-json', nullable: true })
  elevation!: unknown;

  @Column({ type: 'simple-json', name: 'heart_rate', nullable: true })
  heartRate!: unknown;

  @Column({ type: 'simple-json', nullable: true })
  route!: unknown;

  @Column({ type: 'simple-json', name: 'time_series', nullable: true })
  timeSeries!: unknown;

  @Column({ type: 'simple-json', nullable: true })
  metadata!: unknown;

  @CreateDateColumn({ type: 'datetime', name: 'ingested_at' })
  ingestedAt!: Date;
}
