const logger = require('../utils/logger');
const { validateTaskInput } = require('../validators/task.validator');

const validateTaskCreation = (req, res, next) => {
  const validation = validateTaskInput(req.body);

  if (!validation.isValid) {
    logger.warn('Validation failed', {
      endpoint: req.originalUrl,
      method: req.method,
      errors: validation.errors,
      timestamp: new Date().toISOString()
    });

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: validation.errors
      }
    });
  }

  // Replace request body with normalized data
  req.body = validation.normalizedData;
  next();
};

module.exports = { validateTaskCreation };
