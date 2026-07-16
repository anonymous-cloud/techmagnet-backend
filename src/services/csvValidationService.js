const { validateCsvRow } = require('../validators/task.validator');

/**
 * Validates parsed CSV rows
 * @param {Array<Object>} parsedRows - Raw parsed CSV rows
 * @returns {Object} Validation summary and categorized rows
 */
function validateCsvRows(parsedRows) {
  const validRows = [];
  const invalidDetails = [];
  
  parsedRows.forEach((row, index) => {
    const csvRowNumber = index + 2; // header is row 1
    const errors = validateCsvRow(row, csvRowNumber);
    
    if (errors.length > 0) {
      invalidDetails.push({
        row: csvRowNumber,
        errors
      });
    } else {
      // Normalize and push to valid rows
      validRows.push({
        keyword: row.keyword,
        language_code: row.language || row.language_code,
        location_code: parseInt(row.location || row.location_code, 10),
        priority: parseInt(row.priority, 10),
        created_by: 'system' // default creator
      });
    }
  });

  return {
    totalRows: parsedRows.length,
    validRows,
    invalidRows: invalidDetails.length,
    invalidDetails
  };
}

module.exports = {
  validateCsvRows
};
