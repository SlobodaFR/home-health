/** Port (driven side) implemented by the infrastructure layer. */
export abstract class UnitOfWork {
  /** Runs `work` atomically: repository writes performed during it commit or roll back together. */
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
