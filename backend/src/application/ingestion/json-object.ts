export type JsonObject = Record<string, unknown>;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function pick(
  source: JsonObject,
  keys: readonly string[],
): JsonObject | null {
  const result: JsonObject = {};
  for (const key of keys) {
    if (key in source) {
      result[key] = source[key];
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function pickByPrefix(
  source: JsonObject,
  prefix: string,
): JsonObject | null {
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith(prefix)) {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function omit(
  source: JsonObject,
  keys: ReadonlySet<string>,
): JsonObject | null {
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(source)) {
    if (!keys.has(key)) {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}
