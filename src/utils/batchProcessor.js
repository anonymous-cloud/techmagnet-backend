/**
 * Splits an array into batches of the specified size.
 * @param {Array} items - The items to batch.
 * @param {number} batchSize - Maximum number of items per batch.
 * @returns {Array<Array>} Array of batches.
 */
function batchProcessor(items, batchSize = 100) {
  const batches = [];

  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  return batches;
}

module.exports = { batchProcessor };