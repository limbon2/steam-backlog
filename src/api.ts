import type {
  ApiErrorBody,
  ConnectRequest,
  DetectedAccount,
  ErrorField,
  Game,
  GameStatus,
  LibraryResponse,
  SettingsResponse,
} from '../shared/types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: ErrorField,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  } catch {
    throw new ApiError("Can't reach the Backlog server. Is it still running?", 0);
  }
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const error = body as Partial<ApiErrorBody> | null;
    throw new ApiError(error?.message ?? `Request failed (HTTP ${res.status}).`, res.status, error?.field);
  }
  return body as T;
}

const send = (method: string, body: unknown = {}): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  library: () => request<LibraryResponse>('/library'),
  sync: () => request<LibraryResponse>('/sync', send('POST')),
  setStatus: (appId: number, status: GameStatus) => request<Game>(`/games/${appId}`, send('PATCH', { status })),
  settings: () => request<SettingsResponse>('/settings'),
  updateSettings: (patch: { autoSync: boolean }) => request<SettingsResponse>('/settings', send('PATCH', patch)),
  detectAccounts: () => request<{ accounts: DetectedAccount[] }>('/steam/detect'),
  connect: (body: ConnectRequest) => request<LibraryResponse>('/settings/steam', send('PUT', body)),
  disconnect: () => request<LibraryResponse>('/settings/steam', send('DELETE')),
};
