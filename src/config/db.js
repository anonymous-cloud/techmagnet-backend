const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'techmagnet',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    logger.info('Database connection established successfully');
    
    // Auto-create database tables if they do not exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id VARCHAR(255) NULL,
        status_code INT DEFAULT 0,
        status_message VARCHAR(50) DEFAULT 'PENDING',
        cost DECIMAL(8,4) DEFAULT 0.0000,
        execution_time DECIMAL(8,4) DEFAULT 0.0000,
        keyword VARCHAR(255) NOT NULL,
        location_code INT NOT NULL,
        language_code VARCHAR(10) NOT NULL,
        priority INT DEFAULT 1,
        created_by VARCHAR(50) DEFAULT 'system',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS task_jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        task_id INT NOT NULL,
        job_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        error_message TEXT NULL,
        attempts INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    connection.release();
  } catch (error) {
    logger.error('Database connection failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  pool,
  testConnection
};
