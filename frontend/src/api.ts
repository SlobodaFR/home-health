export interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

export interface ApiKey {
  id: string;
  label: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreatedApiKey extends ApiKey {
  rawKey: string;
  ingestUrl: string;
  readBaseUrl: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'include' });
  if (!response.ok) {
    throw new Error(
      `${init?.method ?? 'GET'} ${path} failed: ${response.status.toString()}`,
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function fetchCurrentUser(): Promise<{ user: CurrentUser }> {
  return request('/auth/me');
}

export function fetchApiKeys(): Promise<ApiKey[]> {
  return request('/api-keys');
}

export function createApiKey(label: string): Promise<CreatedApiKey> {
  return request('/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
}

export function revokeApiKey(id: string): Promise<void> {
  return request(`/api-keys/${id}`, { method: 'DELETE' });
}
