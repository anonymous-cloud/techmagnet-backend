-- Migration: Create task_jobs table for async processing lifecycle
-- This table tracks BullMQ jobs, worker processing status, retries, and execution lifecycle
-- Separates queue processing information from business data in tasks table

USE dataforseo_tasks;

-- Create task_jobs table
CREATE TABLE task_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL COMMENT 'Foreign key to tasks.id',
  job_id VARCHAR(255) NULL COMMENT 'BullMQ job ID',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT 'Queue processing status',
  attempts INT NOT NULL DEFAULT 0 COMMENT 'Number of processing attempts',
  error_message TEXT NULL COMMENT 'Error message if job failed',
  started_at TIMESTAMP NULL COMMENT 'When worker started processing',
  completed_at TIMESTAMP NULL COMMENT 'When job completed successfully',
  failed_at TIMESTAMP NULL COMMENT 'When job failed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Foreign key constraint
  CONSTRAINT fk_task_jobs_task_id FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  
  -- Check constraint for status values
  CONSTRAINT chk_task_jobs_status CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
  
  -- Indexes
  INDEX idx_task_jobs_task_id (task_id),
  INDEX idx_task_jobs_job_id (job_id),
  INDEX idx_task_jobs_status (status),
  INDEX idx_task_jobs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
