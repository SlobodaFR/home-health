import {
  Between,
  FindOperator,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { DateRangeQuery } from '../../domain/shared/date-range-query';

export function dateRangeWhere(
  query: DateRangeQuery,
): FindOperator<string> | undefined {
  if (query.from && query.to) {
    return Between(query.from, query.to);
  }
  if (query.from) {
    return MoreThanOrEqual(query.from);
  }
  if (query.to) {
    return LessThanOrEqual(query.to);
  }
  return undefined;
}

export const DEFAULT_LIST_LIMIT = 100;
export const MAX_LIST_LIMIT = 1000;

export function clampLimit(limit?: number): number {
  if (!limit) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.min(Math.max(1, limit), MAX_LIST_LIMIT);
}
