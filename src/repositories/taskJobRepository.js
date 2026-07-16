const { pool } = require('../config/db');
const logger = require('../utils/logger');
const { ValidationError } = require('../errors');

class TaskJobRepository {
  /**
   * Creates a new task_jobs mapping
   */
  async create(jobData) {
    if (!jobData || typeof jobData !== 'object') {
      throw new ValidationError('jobData must be a valid object');
    }
    if (jobData.task_id === undefined || jobData.task_id === null || isNaN(Number(jobData.task_id))) {
      throw new ValidationError(`task_id must be a valid number, received: ${jobData.task_id}`);
    }
    if (!jobData.job_id || typeof jobData.job_id !== 'string' || !jobData.job_id.trim()) {
      throw new ValidationError(`job_id must be a valid string, received: ${jobData.job_id}`);
    }

    try {
      const query = `
        INSERT INTO task_jobs (task_id, job_id, status, error_message, attempts)
        VALUES (?, ?, ?, ?, ?)
      `;
      const values = [
        jobData.task_id,
        jobData.job_id,
        jobData.status || 'PENDING',
        jobData.error_message || null,
        jobData.attempts || 0
      ];
      const [result] = await pool.execute(query, values);
      return { id: result.insertId, ...jobData };
    } catch (error) {
      logger.error('Database error in TaskJobRepository.create', { error: error.message, jobData });
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Creates multiple task_jobs in bulk
   */
  async createBulk(jobsArray) {
    if (!Array.isArray(jobsArray)) {
      throw new ValidationError('jobsArray must be a valid array');
    }
    if (jobsArray.length === 0) return [];

    // Validate elements
    jobsArray.forEach((job, idx) => {
      if (!job || typeof job !== 'object') {
        throw new ValidationError(`Job at index ${idx} must be a valid object`);
      }
      if (job.task_id === undefined || job.task_id === null || isNaN(Number(job.task_id))) {
        throw new ValidationError(`Job at index ${idx} has invalid task_id: ${job.task_id}`);
      }
      if (!job.job_id || typeof job.job_id !== 'string' || !job.job_id.trim()) {
        throw new ValidationError(`Job at index ${idx} has invalid job_id: ${job.job_id}`);
      }
    });

    try {
      const query = `
        INSERT INTO task_jobs (task_id, job_id, status, error_message, attempts)
        VALUES ?
      `;
      const values = jobsArray.map(job => [
        job.task_id,
        job.job_id,
        job.status || 'PENDING',
        job.error_message || null,
        job.attempts || 0
      ]);

      const [result] = await pool.query(query, [values]);
      return result;
    } catch (error) {
      logger.error('Database error in TaskJobRepository.createBulk', { error: error.message });
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Updates task jobs status by BullMQ job ID
   */
  async updateByJobId(jobId, updateData) {
    if (!jobId || typeof jobId !== 'string' || !jobId.trim()) {
      throw new ValidationError(`jobId must be a valid string, received: ${jobId}`);
    }
    if (!updateData || typeof updateData !== 'object' || Object.keys(updateData).length === 0) {
      throw new ValidationError('updateData must be a non-empty object');
    }

    // Ensure no values are undefined
    for (const [key, val] of Object.entries(updateData)) {
      if (val === undefined) {
        throw new ValidationError(`Update field "${key}" cannot be undefined`);
      }
    }

    try {
      const fields = [];
      const values = [];

      for (const [key, val] of Object.entries(updateData)) {
        fields.push(`${key} = ?`);
        values.push(val);
      }

      if (fields.length === 0) return;

      const query = `UPDATE task_jobs SET ${fields.join(', ')} WHERE job_id = ?`;
      values.push(jobId);

      await pool.execute(query, values);
    } catch (error) {
      logger.error('Database error in TaskJobRepository.updateByJobId', { error: error.message, jobId, updateData });
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Updates status by task ID
   */
  async updateByTaskId(taskId, updateData) {
    if (taskId === undefined || taskId === null || isNaN(Number(taskId))) {
      throw new ValidationError(`taskId must be a valid number, received: ${taskId}`);
    }
    if (!updateData || typeof updateData !== 'object' || Object.keys(updateData).length === 0) {
      throw new ValidationError('updateData must be a non-empty object');
    }

    // Ensure no values are undefined
    for (const [key, val] of Object.entries(updateData)) {
      if (val === undefined) {
        throw new ValidationError(`Update field "${key}" cannot be undefined`);
      }
    }

    try {
      const fields = [];
      const values = [];

      for (const [key, val] of Object.entries(updateData)) {
        fields.push(`${key} = ?`);
        values.push(val);
      }

      if (fields.length === 0) return;

      const query = `UPDATE task_jobs SET ${fields.join(', ')} WHERE task_id = ?`;
      values.push(taskId);

      await pool.execute(query, values);
    } catch (error) {
      logger.error('Database error in TaskJobRepository.updateByTaskId', { error: error.message, taskId, updateData });
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Finds job records by Job ID
   */
  async findByJobId(jobId) {
    if (!jobId || typeof jobId !== 'string' || !jobId.trim()) {
      throw new ValidationError(`jobId must be a valid string, received: ${jobId}`);
    }

    try {
      const query = 'SELECT * FROM task_jobs WHERE job_id = ?';
      const [rows] = await pool.execute(query, [jobId]);
      return rows;
    } catch (error) {
      logger.error('Database error in TaskJobRepository.findByJobId', { error: error.message, jobId });
      throw new Error(`Database error: ${error.message}`);
    }
  }
}

module.exports = new TaskJobRepository();

