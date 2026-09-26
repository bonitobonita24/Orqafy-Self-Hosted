import { describe, expect, it } from 'vitest';

import {
  PermanentSendError,
  RetryableSendError,
  classifyHttpStatus,
  classifyTrpcError,
} from './errors';

describe('classifyHttpStatus', () => {
  it.each([401, 408, 429, 500, 502, 503, 504])('%i is retryable', (status) => {
    expect(classifyHttpStatus(status)).toBe('retryable');
  });

  it.each([400, 403, 404, 409, 411, 413, 415, 422])('%i is permanent', (status) => {
    expect(classifyHttpStatus(status)).toBe('permanent');
  });
});

describe('classifyTrpcError', () => {
  it('passes typed send errors through unchanged', () => {
    const p = new PermanentSendError('nope');
    const r = new RetryableSendError('later');
    expect(classifyTrpcError(p)).toBe(p);
    expect(classifyTrpcError(r)).toBe(r);
  });

  it('maps a tRPC FORBIDDEN (httpStatus 403) to permanent', () => {
    const err = Object.assign(new Error('not assignee'), {
      data: { code: 'FORBIDDEN', httpStatus: 403 },
    });
    const out = classifyTrpcError(err);
    expect(out).toBeInstanceOf(PermanentSendError);
    expect(out.message).toContain('not assignee');
  });

  it('maps a tRPC UNAUTHORIZED (401) and 5xx to retryable', () => {
    const unauth = Object.assign(new Error('x'), { data: { httpStatus: 401 } });
    const boom = Object.assign(new Error('y'), { data: { httpStatus: 500 } });
    expect(classifyTrpcError(unauth)).toBeInstanceOf(RetryableSendError);
    expect(classifyTrpcError(boom)).toBeInstanceOf(RetryableSendError);
  });

  it('treats an error with no HTTP status (network failure) as retryable', () => {
    expect(classifyTrpcError(new TypeError('Network request failed'))).toBeInstanceOf(
      RetryableSendError,
    );
    expect(classifyTrpcError('weird')).toBeInstanceOf(RetryableSendError);
  });
});
