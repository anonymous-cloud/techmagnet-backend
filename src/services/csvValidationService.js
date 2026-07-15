const { validateCsvRow } = require('../validators/task.validator');

function validateCsvRows(rows) {
  const validRows = [];
  const invalidRows = [];

  rows.forEach((row) => {
    const { isValid, errors, normalizedData } = validateCsvRow(row);

    if (isValid) {
      validRows.push({ row: row.row, ...normalizedData });
    } else {
      invalidRows.push({ row: row.row, errors });
    }
  });

  return {
    totalRows: rows.length,
    validRows,
    invalidRows
  };
}

module.exports = { validateCsvRows };