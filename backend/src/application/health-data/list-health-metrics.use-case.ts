import { Injectable } from '@nestjs/common';
import { HealthMetric } from '../../domain/health-metric/health-metric';
import {
  HealthMetricRepository,
  ListHealthMetricsQuery,
} from '../../domain/health-metric/health-metric.repository';

@Injectable()
export class ListHealthMetricsUseCase {
  constructor(
    private readonly healthMetricRepository: HealthMetricRepository,
  ) {}

  async execute(
    userId: string,
    query: ListHealthMetricsQuery,
  ): Promise<HealthMetric[]> {
    return this.healthMetricRepository.list(userId, query);
  }
}
