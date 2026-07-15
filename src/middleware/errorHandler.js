const logger = require('../utils/logger');

/**
 * Global error handling middleware
 * Catches all errors and returns consistent JSON responses
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('Error occurred', {
    error: err.message,
    code: err.code || 'UNKNOWN',
    statusCode: err.statusCode || 500,
    path: req.path,
    method: req.method
  });

  // Handle operational errors (AppError and its subclasses)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message
      }
    });
  }

  // Handle unexpected errors
  // Don't expose stack traces in production
  const isDevelopment = process.env.NODE_ENV !== 'production';

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isDevelopment ? err.message : 'An unexpected error occurred',
      ...(isDevelopment && { stack: err.stack })
    }
  });
};

module.exports = errorHandler;
