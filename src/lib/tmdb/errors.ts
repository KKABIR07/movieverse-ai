/** Error raised by the server-side TMDB client. `status` is the upstream HTTP status (0 = network/timeout). */
export class TmdbError extends Error {
  readonly status: number;
  readonly path: string;
  constructor(status: number, path: string, message?: string, cause?: unknown) {
    super(message ?? `TMDB ${status || 'network error'} for ${path}`, cause !== undefined ? { cause } : undefined);
    this.name = 'TmdbError';
    this.status = status;
    this.path = path;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  /** Worth retrying later (5xx, 429, network/timeout). */
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}
