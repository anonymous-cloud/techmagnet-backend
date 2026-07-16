const logger = require('../utils/logger');

/**
 * Express global error handling middleware
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'UNKNOWN_ERROR';
  const errorMessage = err.message || 'An unexpected error occurred';

  logger.error('Error occurred', {
    method: req.method,
    path: req.path,
    statusCode,
    code: errorCode,
    error: errorMessage,
    stack: err.stack
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message: errorMessage
    }
  });
}

module.exports = errorHandler;
