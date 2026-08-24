export interface DateRangeQuery {
  /** Inclusive lower bound, compared lexicographically against the stored date string. */
  from?: string;
  /** Inclusive upper bound, compared lexicographically against the stored date string. */
  to?: string;
  limit?: number;
}
