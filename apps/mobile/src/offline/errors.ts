// Typed outbox send failures (D-28). PURE module.
//
// `drainOutbox` distinguishes three outcomes of a rejected send:
//  - RetryableSendError  -> entry stays `pending` (attempts++) and is re-sent on the
//                           next drain (offline, 5xx, 401 before re-login, 429).
//  - PermanentSendError  -> entry goes `failed` and is never re-sent (the server
//                           rejected the request itself: 400/403/409/411/413/415...).
//  - any other error     -> `failed` (the pre-D-28 behaviour, kept for the existing
//                           task/notification/leave mappings).

/** A failure that will not succeed on retry — surfaced as `failed`, never re-sent. */
export class PermanentSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentSendError';
  }
}

/** A transient failure — the entry stays pending for the next drain. */
export class RetryableSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableSendError';
  }
}

/**
 * HTTP status -> retry class. 401 (token expired; retry after re-login), 408,
 * 429 (rate limit) and every 5xx are transient; every other 4xx is permanent.
 */
export function classifyHttpStatus(status: number): 'retryable' | 'permanent' {
  if (status === 401 || status === 408 || status === 429 || status >= 500) return 'retryable';
  return 'permanent';
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Pull `data.httpStatus` off a TRPCClientError-shaped error (structural, no import). */
function httpStatusOf(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const data = (err as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) return undefined;
  const status = (data as { httpStatus?: unknown }).httpStatus;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Wrap an error thrown by a tRPC mutation in the matching typed send error.
 * No HTTP status (fetch never got a response) is treated as a network failure
 * and therefore retryable.
 */
export function classifyTrpcError(err: unknown): PermanentSendError | RetryableSendError {
  if (err instanceof PermanentSendError || err instanceof RetryableSendError) return err;
  const status = httpStatusOf(err);
  const message = errorMessage(err);
  if (status === undefined) return new RetryableSendError(message);
  return classifyHttpStatus(status) === 'retryable'
    ? new RetryableSendError(`HTTP ${status}: ${message}`)
    : new PermanentSendError(`HTTP ${status}: ${message}`);
}
