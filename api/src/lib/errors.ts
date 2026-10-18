import { API_ERRORS, type ErrorCode, type ErrorResponse } from '@family-night/shared';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details: unknown;
  readonly userMessage: string;

  constructor(code: ErrorCode, details?: unknown, userMessage: string = API_ERRORS[code].message) {
    super(code);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.userMessage = userMessage;
  }

  get status(): (typeof API_ERRORS)[ErrorCode]['status'] {
    return API_ERRORS[this.code].status;
  }

  toBody(): ErrorResponse {
    const error: ErrorResponse['error'] = {
      code: this.code,
      message: this.userMessage,
    };
    if (this.details !== undefined) error.details = this.details;
    return { error };
  }
}
