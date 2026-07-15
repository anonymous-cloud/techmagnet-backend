const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    logger.info('MySQL connected successfully');
    connection.release();
  } catch (error) {
    logger.error('MySQL connection failed', { error: error.message });
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
