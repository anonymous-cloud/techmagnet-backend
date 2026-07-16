const csv = require('csv-parser');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Parses a CSV file from a given path
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Array<Object>>} Parsed rows
 */
function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Trim headers and values
        const cleanedData = {};
        for (let [key, value] of Object.entries(data)) {
          cleanedData[key.trim().toLowerCase()] = value ? value.trim() : '';
        }
        results.push(cleanedData);
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        logger.error('Error parsing CSV', { error: error.message, filePath });
        reject(error);
      });
  });
}

module.exports = {
  parseCsvFile
};
