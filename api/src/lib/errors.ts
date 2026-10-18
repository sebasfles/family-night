import { API_ERRORS, type ErrorCode, type ErrorResponse } from '@family-night/shared';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(code: ErrorCode, details?: unknown) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  get status(): (typeof API_ERRORS)[ErrorCode]['status'] {
    return API_ERRORS[this.code].status;
  }

  toBody(): ErrorResponse {
    const error: ErrorResponse['error'] = {
      code: this.code,
      message: API_ERRORS[this.code].message,
    };
    if (this.details !== undefined) error.details = this.details;
    return { error };
  }
}
