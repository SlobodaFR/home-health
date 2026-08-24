export interface Workout {
  id: string;
  userId: string;
  name: string;
  start: string;
  end: string;
  duration: number;
  location: string | null;
  energy: unknown;
  distanceSpeed: unknown;
  elevation: unknown;
  heartRate: unknown;
  route: unknown;
  timeSeries: unknown;
  metadata: unknown;
}
