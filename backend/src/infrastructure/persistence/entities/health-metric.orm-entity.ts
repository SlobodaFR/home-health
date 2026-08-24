import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/**
 * One data point of a named metric (step_count, heart_rate, ...). Upserted on
 * (user_id, name, date, source) so repeated/batched Auto Export runs stay idempotent.
 */
@Entity({ name: 'health_metrics' })
@Index(['userId', 'name', 'date', 'source'], { unique: true })
export class HealthMetricOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Index()
  @Column({ type: 'text', name: 'user_id' })
  userId!: string;

  @Index()
  @Column('text')
  name!: string;

  @Column('text')
  units!: string;

  @Index()
  @Column('text')
  date!: string;

  /** Never null in storage - empty string when Auto Export omits it, so the unique index behaves. */
  @Column('text')
  source!: string;

  @Column({ type: 'simple-json' })
  payload!: unknown;

  @CreateDateColumn({ type: 'datetime', name: 'ingested_at' })
  ingestedAt!: Date;
}
