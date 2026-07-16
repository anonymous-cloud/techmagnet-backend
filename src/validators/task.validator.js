const { AppError } = require('../errors');

/**
 * Validates the single task JSON payload
 */
function validateSingleTask(data) {
  const errors = [];
  
  if (!data.keyword || typeof data.keyword !== 'string' || !data.keyword.trim()) {
    errors.push('Keyword is required and must be a string');
  }
  
  if (!data.language && !data.language_code) {
    errors.push('Language code is required');
  }
  
  if (data.location === undefined && data.location_code === undefined) {
    errors.push('Location code is required');
  } else {
    const loc = data.location !== undefined ? data.location : data.location_code;
    if (isNaN(parseInt(loc, 10))) {
      errors.push('Location code must be a valid number');
    }
  }
  
  if (data.priority !== undefined) {
    const prio = parseInt(data.priority, 10);
    if (prio !== 1 && prio !== 2) {
      errors.push('Priority must be 1 or 2');
    }
  }

  if (errors.length > 0) {
    throw new AppError(errors.join(', '), 400, 'VALIDATION_ERROR');
  }
}

/**
 * Validates a single row from a CSV upload
 * @param {Object} row - Parsed CSV row
 * @param {number} rowIndex - 1-based index of row in CSV
 * @returns {Array<string>} List of validation errors
 */
function validateCsvRow(row, rowIndex) {
  const errors = [];
  
  const keyword = row.keyword;
  const language = row.language || row.language_code;
  const location = row.location || row.location_code;
  const priority = row.priority;

  if (!keyword || !keyword.trim()) {
    errors.push('Keyword is required');
  }

  if (!language || !language.trim()) {
    errors.push('Language is required');
  }

  if (!location || !location.trim()) {
    errors.push('Location is required');
  } else if (isNaN(parseInt(location, 10))) {
    errors.push('Location must be a number');
  }

  if (!priority || !priority.trim()) {
    errors.push('Priority is required');
  } else {
    const prioNum = parseInt(priority, 10);
    if (prioNum !== 1 && prioNum !== 2) {
      errors.push('Priority must be 1 or 2');
    }
  }

  return errors;
}

/**
 * Validates query parameters for retrieving tasks (dashboard filters)
 * @param {Object} query - req.query object
 */
function validateGetTasksQuery(query) {
  const errors = [];

  // 1. Page
  if (query.page !== undefined) {
    const pageVal = parseInt(query.page, 10);
    if (isNaN(pageVal) || pageVal < 1) {
      errors.push('Page must be a positive integer greater than or equal to 1');
    }
  }

  // 2. Limit
  if (query.limit !== undefined) {
    const limitVal = parseInt(query.limit, 10);
    if (isNaN(limitVal) || limitVal < 1) {
      errors.push('Limit must be a positive integer greater than or equal to 1');
    } else if (limitVal > 100) {
      errors.push('Limit cannot exceed 100');
    }
  }

  // 3. Offset
  if (query.offset !== undefined) {
    const offsetVal = parseInt(query.offset, 10);
    if (isNaN(offsetVal) || offsetVal < 0) {
      errors.push('Offset must be a non-negative integer');
    }
  }

  // 4. Sort columns validation
  const approvedSortColumns = [
    'id',
    'keyword',
    'language_code',
    'location_code',
    'priority',
    'status_code',
    'status_message',
    'cost',
    'created_at'
  ];
  if (query.sortBy !== undefined) {
    if (!approvedSortColumns.includes(query.sortBy)) {
      errors.push(`sortBy must be one of the approved columns: ${approvedSortColumns.join(', ')}`);
    }
  }

  // 5. Sort order validation
  if (query.sortOrder !== undefined) {
    const order = String(query.sortOrder).toUpperCase();
    if (order !== 'ASC' && order !== 'DESC') {
      errors.push("sortOrder must be 'ASC' or 'DESC'");
    }
  }

  // 6. Filters type validation
  if (query.status_code !== undefined) {
    if (isNaN(parseInt(query.status_code, 10))) {
      errors.push('status_code filter must be a valid number');
    }
  }
  if (query.priority !== undefined) {
    const p = parseInt(query.priority, 10);
    if (isNaN(p) || (p !== 1 && p !== 2)) {
      errors.push('priority filter must be 1 or 2');
    }
  }
  if (query.location_code !== undefined) {
    if (isNaN(parseInt(query.location_code, 10))) {
      errors.push('location_code filter must be a valid number');
    }
  }
  
  if (query.startDate !== undefined) {
    const d = new Date(query.startDate);
    if (isNaN(d.getTime())) {
      errors.push('startDate must be a valid date');
    }
  }
  if (query.endDate !== undefined) {
    const d = new Date(query.endDate);
    if (isNaN(d.getTime())) {
      errors.push('endDate must be a valid date');
    }
  }

  if (errors.length > 0) {
    throw new AppError(errors.join(', '), 400, 'VALIDATION_ERROR');
  }
}

module.exports = {
  validateSingleTask,
  validateCsvRow,
  validateGetTasksQuery
};
