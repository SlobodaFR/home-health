import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1787572677428 implements MigrationInterface {
  name = 'InitSchema1787572677428';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "api_keys" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "label" text NOT NULL, "hashed_key" text NOT NULL, "last_used_at" datetime, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "revoked_at" datetime)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a3baee01d8408cd3c0f89a9a97" ON "api_keys" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "cycle_tracking_entries" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "date" text NOT NULL, "payload" text NOT NULL, "ingested_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_748009d784219430c1b9fc63a3" ON "cycle_tracking_entries" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3fa33c37f0b7de2248765229be" ON "cycle_tracking_entries" ("date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ecg_readings" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "date" text NOT NULL, "payload" text NOT NULL, "ingested_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_adf2a456832f8a73f523f2e0ed" ON "ecg_readings" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8b9dcaed6a8e1c5238caf22c73" ON "ecg_readings" ("date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "health_metrics" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "name" text NOT NULL, "units" text NOT NULL, "date" text NOT NULL, "source" text NOT NULL, "payload" text NOT NULL, "ingested_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7e75554556598bce9347a6ad80" ON "health_metrics" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ecadd5ce9c0fe5f5f6c93ddabb" ON "health_metrics" ("name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_679b5bf7dc50ed9320af2c42a8" ON "health_metrics" ("date") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c4b7b2ec5068ae42bdb92623d5" ON "health_metrics" ("user_id", "name", "date", "source") `,
    );
    await queryRunner.query(
      `CREATE TABLE "heart_rate_notifications" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "date" text NOT NULL, "payload" text NOT NULL, "ingested_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e126a407a473c2cafd2b7cd6d6" ON "heart_rate_notifications" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bd503d4ed432e405da992f42fc" ON "heart_rate_notifications" ("date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "medication_entries" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "date" text NOT NULL, "payload" text NOT NULL, "ingested_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3269fbe72417d0bd8166903439" ON "medication_entries" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_15b268e1d2b2426f77d0f6a5c8" ON "medication_entries" ("date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "raw_ingestions" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "automation_id" text, "automation_name" text, "session_id" text, "data_type" text NOT NULL, "payload" text NOT NULL, "received_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f2b6385a9fa2a1b26886d264a0" ON "raw_ingestions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "state_of_mind_entries" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "date" text NOT NULL, "payload" text NOT NULL, "ingested_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1c0eda7e1f256d55bc648c6eda" ON "state_of_mind_entries" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0ef26dfd101f4c5a3fdab8709b" ON "state_of_mind_entries" ("date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "symptoms" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "date" text NOT NULL, "payload" text NOT NULL, "ingested_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2e71f3acf01760171725ec17bb" ON "symptoms" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0b5a43e038417e162361bd2938" ON "symptoms" ("date") `,
    );
    await queryRunner.query(
      `CREATE TABLE "workouts" ("id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "name" text NOT NULL, "start" text NOT NULL, "end" text NOT NULL, "duration" integer NOT NULL, "location" text, "energy" text, "distance_speed" text, "elevation" text, "heart_rate" text, "route" text, "time_series" text, "metadata" text, "ingested_at" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2df679279a7ac263bcff20c78d" ON "workouts" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dc640dba06464a9d99c48b0891" ON "workouts" ("start") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_dc640dba06464a9d99c48b0891"`);
    await queryRunner.query(`DROP INDEX "IDX_2df679279a7ac263bcff20c78d"`);
    await queryRunner.query(`DROP TABLE "workouts"`);
    await queryRunner.query(`DROP INDEX "IDX_0b5a43e038417e162361bd2938"`);
    await queryRunner.query(`DROP INDEX "IDX_2e71f3acf01760171725ec17bb"`);
    await queryRunner.query(`DROP TABLE "symptoms"`);
    await queryRunner.query(`DROP INDEX "IDX_0ef26dfd101f4c5a3fdab8709b"`);
    await queryRunner.query(`DROP INDEX "IDX_1c0eda7e1f256d55bc648c6eda"`);
    await queryRunner.query(`DROP TABLE "state_of_mind_entries"`);
    await queryRunner.query(`DROP INDEX "IDX_f2b6385a9fa2a1b26886d264a0"`);
    await queryRunner.query(`DROP TABLE "raw_ingestions"`);
    await queryRunner.query(`DROP INDEX "IDX_15b268e1d2b2426f77d0f6a5c8"`);
    await queryRunner.query(`DROP INDEX "IDX_3269fbe72417d0bd8166903439"`);
    await queryRunner.query(`DROP TABLE "medication_entries"`);
    await queryRunner.query(`DROP INDEX "IDX_bd503d4ed432e405da992f42fc"`);
    await queryRunner.query(`DROP INDEX "IDX_e126a407a473c2cafd2b7cd6d6"`);
    await queryRunner.query(`DROP TABLE "heart_rate_notifications"`);
    await queryRunner.query(`DROP INDEX "IDX_c4b7b2ec5068ae42bdb92623d5"`);
    await queryRunner.query(`DROP INDEX "IDX_679b5bf7dc50ed9320af2c42a8"`);
    await queryRunner.query(`DROP INDEX "IDX_ecadd5ce9c0fe5f5f6c93ddabb"`);
    await queryRunner.query(`DROP INDEX "IDX_7e75554556598bce9347a6ad80"`);
    await queryRunner.query(`DROP TABLE "health_metrics"`);
    await queryRunner.query(`DROP INDEX "IDX_8b9dcaed6a8e1c5238caf22c73"`);
    await queryRunner.query(`DROP INDEX "IDX_adf2a456832f8a73f523f2e0ed"`);
    await queryRunner.query(`DROP TABLE "ecg_readings"`);
    await queryRunner.query(`DROP INDEX "IDX_3fa33c37f0b7de2248765229be"`);
    await queryRunner.query(`DROP INDEX "IDX_748009d784219430c1b9fc63a3"`);
    await queryRunner.query(`DROP TABLE "cycle_tracking_entries"`);
    await queryRunner.query(`DROP INDEX "IDX_a3baee01d8408cd3c0f89a9a97"`);
    await queryRunner.query(`DROP TABLE "api_keys"`);
  }
}
