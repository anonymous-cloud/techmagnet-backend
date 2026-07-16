class AppError extends Error {
  /**
   * Custom application error
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Application-specific error code
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.isNonRetryable = true;
  }
}

class RecordNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RecordNotFoundError';
    this.isNonRetryable = true;
  }
}

module.exports = {
  AppError,
  ValidationError,
  RecordNotFoundError
};

