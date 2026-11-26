import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RevokedSessionRepository } from '../../../domain/auth/revoked-session.repository';
import { RevokedSessionOrmEntity } from '../entities/revoked-session.orm-entity';
import { currentManager } from '../typeorm-unit-of-work';

@Injectable()
export class TypeOrmRevokedSessionRepository extends RevokedSessionRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  private get repository() {
    return currentManager(this.dataSource).getRepository(
      RevokedSessionOrmEntity,
    );
  }

  async markRevoked(userId: string, revokedAt: Date): Promise<void> {
    await this.repository.save({ userId, revokedAt });
  }

  async getRevokedAt(userId: string): Promise<Date | null> {
    const row = await this.repository.findOne({ where: { userId } });
    return row ? row.revokedAt : null;
  }
}
