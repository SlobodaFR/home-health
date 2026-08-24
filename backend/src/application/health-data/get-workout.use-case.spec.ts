import { NotFoundException } from '@nestjs/common';
import { Workout } from '../../domain/workout/workout';
import { WorkoutRepository } from '../../domain/workout/workout.repository';
import { GetWorkoutUseCase } from './get-workout.use-case';

describe('GetWorkoutUseCase', () => {
  const workout: Workout = {
    id: 'wk-1',
    userId: 'user-1',
    name: 'Running',
    start: '2026-01-01T08:00:00Z',
    end: '2026-01-01T08:30:00Z',
    duration: 1800,
    location: null,
    energy: null,
    distanceSpeed: null,
    elevation: null,
    heartRate: null,
    route: null,
    timeSeries: null,
    metadata: null,
  };

  it('returns the workout when found', async () => {
    const repository: WorkoutRepository = {
      upsertMany: () => Promise.resolve(),
      list: () => Promise.resolve([]),
      findById: (userId, id) =>
        Promise.resolve(userId === 'user-1' && id === 'wk-1' ? workout : null),
    };
    const useCase = new GetWorkoutUseCase(repository);

    await expect(useCase.execute('user-1', 'wk-1')).resolves.toEqual(workout);
  });

  it('throws NotFoundException when the workout does not exist or belongs to another user', async () => {
    const repository: WorkoutRepository = {
      upsertMany: () => Promise.resolve(),
      list: () => Promise.resolve([]),
      findById: () => Promise.resolve(null),
    };
    const useCase = new GetWorkoutUseCase(repository);

    await expect(useCase.execute('user-1', 'wk-missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
