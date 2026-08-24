export interface HealthMetric {
  userId: string;
  name: string;
  units: string;
  date: string;
  /** Never undefined in storage - empty string when Auto Export omits it, so the natural key stays stable. */
  source: string;
  payload: unknown;
}
