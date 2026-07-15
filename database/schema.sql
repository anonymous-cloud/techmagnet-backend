CREATE DATABASE IF NOT EXISTS dataforseo_tasks;

USE dataforseo_tasks;

CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id VARCHAR(255) UNIQUE,
  status_code INT NOT NULL,
  status_message VARCHAR(255) NOT NULL,
  cost DECIMAL(10, 4) NOT NULL,
  execution_time DECIMAL(10, 4) NOT NULL,
  keyword VARCHAR(255) NOT NULL,
  location_code INT NOT NULL,
  language_code VARCHAR(10) NOT NULL,
  priority TINYINT NOT NULL CHECK (priority IN (1, 2)),
  created_by VARCHAR(50) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_task_id (task_id),
  INDEX idx_keyword (keyword),
  INDEX idx_status (status_code),
  INDEX idx_created_by (created_by),
  INDEX idx_created_at (created_at)
);
