const { AppError } = require('./index');

/**
 * Error thrown when queue operations fail
 */
class QueueError extends AppError {
  constructor(message = 'Queue operation failed') {
    super(message, 500, 'QUEUE_ERROR');
  }
}

module.exports = QueueError;
