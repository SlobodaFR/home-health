import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { UnitOfWork } from '../../domain/shared/unit-of-work';

/**
 * Holds the transactional EntityManager for the current async context, if
 * `UnitOfWork.run` is on the call stack. Repositories read this to join the
 * ambient transaction instead of using their default (autocommit) manager.
 */
const transactionalManager = new AsyncLocalStorage<EntityManager>();

/** The manager repositories should issue queries against: the ambient transaction's if one is open, else the DataSource's default. */
export function currentManager(dataSource: DataSource): EntityManager {
  return transactionalManager.getStore() ?? dataSource.manager;
}

@Injectable()
export class TypeOrmUnitOfWork extends UnitOfWork {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) =>
      transactionalManager.run(manager, work),
    );
  }
}
