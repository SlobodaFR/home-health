import { parseAutoExportWorkouts } from './parse-auto-export-workouts';

describe('parseAutoExportWorkouts', () => {
  it('keeps the Auto Export v2 id when present', () => {
    const [workout] = parseAutoExportWorkouts('user-1', [
      {
        id: 'wk-abc',
        name: 'Running',
        start: '2026-01-01T08:00:00Z',
        end: '2026-01-01T08:30:00Z',
        duration: 1800,
      },
    ]);

    expect(workout.id).toBe('wk-abc');
  });

  it('derives a stable id from (userId, name, start) when Auto Export omits one (v1)', () => {
    const item = {
      name: 'Running',
      start: '2026-01-01T08:00:00Z',
      end: '2026-01-01T08:30:00Z',
      duration: 1800,
    };

    const [first] = parseAutoExportWorkouts('user-1', [item]);
    const [second] = parseAutoExportWorkouts('user-1', [item]);

    expect(first.id).toBe(second.id);
    expect(first.id).not.toBe('');
  });

  it('groups known optional fields into their columns and the rest into metadata', () => {
    const [workout] = parseAutoExportWorkouts('user-1', [
      {
        id: 'wk-1',
        name: 'Swim',
        start: '2026-01-01T08:00:00Z',
        end: '2026-01-01T08:30:00Z',
        duration: 1800,
        activeEnergyBurned: 300,
        avgSpeed: 1.2,
        avgHeartRate: 140,
        swimCadence: 30,
        route: [{ lat: 1, lng: 2 }],
        somethingUndocumented: 42,
      },
    ]);

    expect(workout.energy).toEqual({ activeEnergyBurned: 300 });
    expect(workout.distanceSpeed).toEqual({ avgSpeed: 1.2 });
    expect(workout.heartRate).toEqual({ avgHeartRate: 140 });
    expect(workout.timeSeries).toEqual({ swimCadence: 30 });
    expect(workout.route).toEqual([{ lat: 1, lng: 2 }]);
    expect(workout.metadata).toEqual({ somethingUndocumented: 42 });
  });

  it('skips items missing a required field', () => {
    const workouts = parseAutoExportWorkouts('user-1', [
      {
        name: 'Running',
        start: '2026-01-01T08:00:00Z',
        end: '2026-01-01T08:30:00Z',
      }, // no duration
      'not-an-object',
    ]);

    expect(workouts).toHaveLength(0);
  });
});
