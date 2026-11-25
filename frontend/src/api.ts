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
  return request('/api/auth/me');
}

/**
 * Local logout. `redirectTo` is home-auth's logout URL when the server runs the
 * service-initiated flow (PC10), null for a local-only logout.
 */
export async function logout(): Promise<{ redirectTo: string | null }> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(
      `POST /api/auth/logout failed: ${response.status.toString()}`,
    );
  }
  const body = (await response.json().catch(() => null)) as {
    redirect_to?: unknown;
  } | null;
  return {
    redirectTo: typeof body?.redirect_to === 'string' ? body.redirect_to : null,
  };
}

export function fetchApiKeys(): Promise<ApiKey[]> {
  return request('/api/api-keys');
}

export function createApiKey(label: string): Promise<CreatedApiKey> {
  return request('/api/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
}

export function revokeApiKey(id: string): Promise<void> {
  return request(`/api/api-keys/${id}`, { method: 'DELETE' });
}
