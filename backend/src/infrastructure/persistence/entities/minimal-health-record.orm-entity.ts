import { Column, CreateDateColumn, Index, PrimaryColumn } from 'typeorm';

/**
 * Shared shape for the Auto Export data types whose payload format is not
 * publicly documented (symptoms, ECG, heart rate notifications, state of
 * mind, cycle tracking, medications). Captured permissively as raw JSON -
 * see DESIGN.md §12 for the plan to normalize once a real export is observed.
 */
export abstract class MinimalHealthRecordOrmEntity {
  @PrimaryColumn('text')
  id!: string;

  @Index()
  @Column({ type: 'text', name: 'user_id' })
  userId!: string;

  @Index()
  @Column('text')
  date!: string;

  @Column({ type: 'simple-json' })
  payload!: any;

  @CreateDateColumn({ type: 'datetime', name: 'ingested_at' })
  ingestedAt!: Date;
}
