/**
 * Base application error class
 * All custom errors should extend this class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a duplicate task is detected
 */
class DuplicateTaskError extends AppError {
  constructor(message = 'Task with this ID already exists') {
    super(message, 409, 'DUPLICATE_TASK');
  }
}

/**
 * Error thrown when external API call fails
 */
class ExternalApiError extends AppError {
  constructor(message = 'External API request failed') {
    super(message, 502, 'EXTERNAL_API_ERROR');
  }
}

/**
 * Error thrown when database operation fails
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

module.exports = {
  AppError,
  DuplicateTaskError,
  ExternalApiError,
  DatabaseError
};
