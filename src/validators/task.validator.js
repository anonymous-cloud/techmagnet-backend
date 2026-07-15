const validateTaskInput = (data) => {
  const errors = [];

  // Trim and normalize input
  const keyword = data.keyword ? data.keyword.trim() : '';
  const language = data.language ? data.language.trim().toLowerCase() : '';
  const location = data.location;
  const priority = data.priority;

  // Validate keyword
  if (!keyword) {
    errors.push({ field: 'keyword', message: 'Keyword is required' });
  } else if (typeof keyword !== 'string') {
    errors.push({ field: 'keyword', message: 'Keyword must be a string' });
  } else if (keyword.length === 0) {
    errors.push({ field: 'keyword', message: 'Keyword cannot be empty' });
  } else if (keyword.length > 255) {
    errors.push({ field: 'keyword', message: 'Keyword must be less than 255 characters' });
  }

  // Validate language
  if (!language) {
    errors.push({ field: 'language', message: 'Language is required' });
  } else if (typeof language !== 'string') {
    errors.push({ field: 'language', message: 'Language must be a string' });
  } else if (!/^[a-z]{2,3}$/.test(language)) {
    errors.push({ field: 'language', message: 'Language must be a valid ISO code (2-3 letters)' });
  }

  // Validate location
  if (location === undefined || location === null) {
    errors.push({ field: 'location', message: 'Location is required' });
  } else if (typeof location !== 'number') {
    errors.push({ field: 'location', message: 'Location must be a number' });
  } else if (!Number.isInteger(location)) {
    errors.push({ field: 'location', message: 'Location must be an integer' });
  } else if (location < 1) {
    errors.push({ field: 'location', message: 'Location must be a positive integer' });
  }

  // Validate priority
  if (priority === undefined || priority === null) {
    errors.push({ field: 'priority', message: 'Priority is required' });
  } else if (typeof priority !== 'number') {
    errors.push({ field: 'priority', message: 'Priority must be a number' });
  } else if (!Number.isInteger(priority)) {
    errors.push({ field: 'priority', message: 'Priority must be an integer' });
  } else if (priority !== 1 && priority !== 2) {
    errors.push({ field: 'priority', message: 'Priority must be 1 or 2' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedData: errors.length === 0 ? { keyword, language, location, priority } : null
  };
};

function validateCsvRow(data) {
  const result = validateTaskInput(data);

  return {
    isValid: result.isValid,
    errors: result.errors.map((error) => error.message),
    normalizedData: result.normalizedData
  };
}

module.exports = { validateTaskInput, validateCsvRow };
