/**
 * Tiny same-origin JSON client for our own `/api/*` routes.
 *
 * Contract (see the API docs): errors are `{ error, code, requestId }`; mutating
 * requests must send `Content-Type: application/json`. Every failure becomes an
 * `ApiError` with the HTTP status (0 = network) and the server's error code so
 * callers can branch on `UNAUTHORIZED`, `WATCHLIST_FULL`, `DB_UNAVAILABLE`, …
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }

  get isAuth(): boolean {
    return this.status === 401;
  }
}

export interface ApiRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

/** Fetch implementation; swappable in tests. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const defaultFetch: FetchLike = (input, init) => fetch(input, init);

export async function apiJson<T>(path: string, req: ApiRequest = {}, fetchImpl: FetchLike = defaultFetch): Promise<T> {
  const method = req.method ?? 'GET';
  const init: RequestInit = {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: req.signal,
    headers: { Accept: 'application/json' },
  };
  if (req.body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(req.body);
  }

  let res: Response;
  try {
    res = await fetchImpl(path, init);
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', 'Network error. Check your connection and try again.');
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const d = (data ?? {}) as { error?: unknown; code?: unknown; requestId?: unknown };
    throw new ApiError(
      res.status,
      typeof d.code === 'string' ? d.code : `HTTP_${res.status}`,
      typeof d.error === 'string' ? d.error : `Request failed (${res.status})`,
      typeof d.requestId === 'string' ? d.requestId : undefined,
    );
  }
  return data as T;
}

/** Human, non-leaky message for a failed request. */
export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.status === 0) return 'You appear to be offline. Please try again.';
  if (err.status === 401) return 'Please sign in to continue.';
  if (err.status === 429 || err.code === 'RATE_LIMITED') return 'Too many requests. Please wait a moment.';
  if (err.code === 'WATCHLIST_FULL') return 'Your watchlist is full (1,000 titles). Remove some to add more.';
  if (err.status === 503 || err.code === 'DB_UNAVAILABLE') return 'Saving is temporarily unavailable. Please try again soon.';
  if (err.status === 400 && err.message) return err.message;
  return fallback;
}
