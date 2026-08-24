import { HealthMetric } from '../../../domain/health-metric/health-metric';

export interface HealthMetricDto {
  name: string;
  units: string;
  date: string;
  source: string;
  payload: unknown;
}

export function toHealthMetricDto(metric: HealthMetric): HealthMetricDto {
  return {
    name: metric.name,
    units: metric.units,
    date: metric.date,
    source: metric.source,
    payload: metric.payload,
  };
}
