const { parse } = require('csv-parse/sync');

function parseCsv(buffer) {
  const content = buffer.toString('utf8');

  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  });

  const rows = records.map((row, index) => ({
    row: index + 2, // header row is row 1
    keyword: row.keyword || row.keyword || '',
    language: row.language || row.language || '',
    location: row.location !== undefined ? Number(row.location) : undefined,
    priority: row.priority !== undefined ? Number(row.priority) : undefined
  }));

  return rows;
}

module.exports = { parseCsv };