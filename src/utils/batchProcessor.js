/**
 * Reusable utility to split arrays into chunks of configurable size
 * @param {Array} array - Array to split
 * @param {number} size - Maximum size of each chunk (default 100)
 * @returns {Array<Array>} Array of chunks
 */
function chunkArray(array, size = 100) {
  if (!Array.isArray(array)) {
    throw new Error('Input must be an array');
  }
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

module.exports = {
  chunkArray
};
