export interface CreateApiKeyResponseDto {
  id: string;
  label: string;
  /** Shown once. Never recoverable afterwards - only a new key can be issued. */
  rawKey: string;
  /** Paste as the "Clé" (API key) value in Health Auto Export's REST API automation. */
  ingestUrl: string;
  /** Base URL home-remote-mcps reads from (GET {readBaseUrl}/metrics, /workouts, ...). */
  readBaseUrl: string;
  createdAt: string;
}
