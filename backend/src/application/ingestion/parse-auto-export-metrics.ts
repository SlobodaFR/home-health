import { HealthMetric } from '../../domain/health-metric/health-metric';
import { isJsonObject } from './json-object';

/**
 * Each entry in Auto Export's "metrics" array is { name, units, data: [...] },
 * where each data point carries a date (or startDate/endDate) plus fields
 * specific to that metric (qty, Min/Avg/Max, systolic/diastolic, value,
 * mealTime, sleep fields, ...). Captured permissively - the whole point
 * becomes `payload`, no per-metric-type schema.
 */
export function parseAutoExportMetrics(
  userId: string,
  rawMetrics: unknown[],
): HealthMetric[] {
  const metrics: HealthMetric[] = [];

  for (const group of rawMetrics) {
    if (!isJsonObject(group) || typeof group.name !== 'string') {
      continue;
    }
    const units = typeof group.units === 'string' ? group.units : '';
    const dataPoints = Array.isArray(group.data) ? group.data : [];

    for (const point of dataPoints) {
      if (!isJsonObject(point)) {
        continue;
      }
      const date =
        typeof point.date === 'string'
          ? point.date
          : typeof point.startDate === 'string'
            ? point.startDate
            : null;
      if (!date) {
        continue;
      }
      const source = typeof point.source === 'string' ? point.source : '';
      metrics.push({
        userId,
        name: group.name,
        units,
        date,
        source,
        payload: point,
      });
    }
  }

  return metrics;
}
