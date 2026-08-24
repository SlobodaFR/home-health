import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRevokedSessions1787573101601 implements MigrationInterface {
  name = 'AddRevokedSessions1787573101601';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "revoked_sessions" ("user_id" text PRIMARY KEY NOT NULL, "revoked_at" datetime NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "revoked_sessions"`);
  }
}
