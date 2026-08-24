import { deterministicId } from '../../domain/shared/hash';
import { Workout } from '../../domain/workout/workout';
import {
  isJsonObject,
  JsonObject,
  omit,
  pick,
  pickByPrefix,
} from './json-object';

const ENERGY_KEYS = ['activeEnergyBurned', 'totalEnergy', 'intensity'] as const;
const DISTANCE_SPEED_KEYS = [
  'distance',
  'speed',
  'avgSpeed',
  'maxSpeed',
] as const;
const HEART_RATE_KEYS = ['heartRate', 'avgHeartRate', 'maxHeartRate'] as const;
const TIME_SERIES_KEYS = [
  'heartRateData',
  'stepCount',
  'cyclingPower',
] as const;

const KNOWN_TOP_LEVEL_KEYS = new Set<string>([
  'id',
  'name',
  'start',
  'end',
  'duration',
  'location',
  'elevation',
  'route',
  ...ENERGY_KEYS,
  ...DISTANCE_SPEED_KEYS,
  ...HEART_RATE_KEYS,
  ...TIME_SERIES_KEYS,
]);

/**
 * Auto Export v2 workouts carry a stable `id`; v1 payloads don't, so one is
 * derived deterministically from (userId, name, start). Known field groups
 * (energy, distance/speed, elevation, heart rate, route, time-series) map to
 * their own columns (DESIGN.md §5); everything else - including swim*
 * time-series fields and any undocumented key - lands in `metadata`.
 */
export function parseAutoExportWorkouts(
  userId: string,
  rawWorkouts: unknown[],
): Workout[] {
  const workouts: Workout[] = [];

  for (const item of rawWorkouts) {
    if (
      !isJsonObject(item) ||
      typeof item.name !== 'string' ||
      typeof item.start !== 'string' ||
      typeof item.end !== 'string' ||
      typeof item.duration !== 'number'
    ) {
      continue;
    }

    const id =
      typeof item.id === 'string' && item.id
        ? item.id
        : deterministicId('workout', userId, item.name, item.start);

    const swimFields = pickByPrefix(item, 'swim');
    const timeSeries = mergeJsonObjects(
      pick(item, TIME_SERIES_KEYS),
      swimFields,
    );
    const metadataExclusions = new Set([
      ...KNOWN_TOP_LEVEL_KEYS,
      ...Object.keys(swimFields ?? {}),
    ]);

    workouts.push({
      id,
      userId,
      name: item.name,
      start: item.start,
      end: item.end,
      duration: item.duration,
      location: typeof item.location === 'string' ? item.location : null,
      energy: pick(item, ENERGY_KEYS),
      distanceSpeed: pick(item, DISTANCE_SPEED_KEYS),
      elevation: item.elevation ?? null,
      heartRate: pick(item, HEART_RATE_KEYS),
      route: item.route ?? null,
      timeSeries,
      metadata: omit(item, metadataExclusions),
    });
  }

  return workouts;
}

function mergeJsonObjects(
  a: JsonObject | null,
  b: JsonObject | null,
): JsonObject | null {
  if (!a && !b) {
    return null;
  }
  return { ...a, ...b };
}
