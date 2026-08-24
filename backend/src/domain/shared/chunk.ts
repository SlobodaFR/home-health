/**
 * SQLite caps bound parameters per statement (SQLITE_MAX_VARIABLE_NUMBER),
 * and a single multi-row upsert/insert inlines every column of every row as
 * a parameter. Auto Export batches can easily exceed that for metrics with
 * many data points, so batch writes are chunked before hitting the driver.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
