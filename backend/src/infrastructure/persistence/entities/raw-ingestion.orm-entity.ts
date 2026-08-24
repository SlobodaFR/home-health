import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

/** Audit trail of every Health Auto Export payload received, verbatim. */
@Entity({ name: 'raw_ingestions' })
export class RawIngestionOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Index()
  @Column({ type: 'text', name: 'user_id' })
  userId!: string;

  @Column({ type: 'text', name: 'automation_id', nullable: true })
  automationId!: string | null;

  @Column({ type: 'text', name: 'automation_name', nullable: true })
  automationName!: string | null;

  @Column({ type: 'text', name: 'session_id', nullable: true })
  sessionId!: string | null;

  @Column({ type: 'text', name: 'data_type' })
  dataType!: string;

  @Column({ type: 'simple-json' })
  payload!: unknown;

  @CreateDateColumn({ type: 'datetime', name: 'received_at' })
  receivedAt!: Date;
}
