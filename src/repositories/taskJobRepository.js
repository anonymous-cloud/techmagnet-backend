const { pool } = require('../config/db');
const logger = require('../utils/logger');

class TaskJobRepository {
  /**
   * Creates a new task job record
   * @param {Object} jobData - Job data to insert
   * @param {number} jobData.task_id - Foreign key to tasks.id
   * @param {string} jobData.job_id - BullMQ job ID
   * @param {string} jobData.status - Queue processing status
   * @returns {Promise<Object>} Created job record
   */
  async create(jobData) {
    try {
      const query = `
        INSERT INTO task_jobs (
          task_id, job_id, status, attempts
        ) VALUES (?, ?, ?, ?)
      `;

      const values = [
        jobData.task_id,
        jobData.job_id,
        jobData.status || 'PENDING',
        jobData.attempts || 0
      ];

      const [result] = await pool.execute(query, values);

      return this.findById(result.insertId);

    } catch (error) {
      logger.error('Database error in TaskJobRepository.create', {
        error: error.message,
        code: error.code,
        jobData: { ...jobData }
      });

      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Finds a job by internal ID
   * @param {number} id - Internal job ID
   * @returns {Promise<Object|null>} Job record or null if not found
   */
  async findById(id) {
    try {
      const query = 'SELECT * FROM task_jobs WHERE id = ?';
      const [rows] = await pool.execute(query, [id]);

      if (rows.length === 0) {
        return null;
      }

      return rows[0];

    } catch (error) {
      logger.error('Database error in TaskJobRepository.findById', {
        error: error.message,
        code: error.code,
        id
      });

      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Finds a job by BullMQ job_id
   * @param {string} jobId - BullMQ job ID
   * @returns {Promise<Object|null>} Job record or null if not found
   */
  async findByJobId(jobId) {
    try {
      const query = 'SELECT * FROM task_jobs WHERE job_id = ?';
      const [rows] = await pool.execute(query, [jobId]);

      if (rows.length === 0) {
        return null;
      }

      return rows[0];

    } catch (error) {
      logger.error('Database error in TaskJobRepository.findByJobId', {
        error: error.message,
        code: error.code,
        jobId
      });

      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Finds a job by task_id
   * @param {number} taskId - Foreign key to tasks.id
   * @returns {Promise<Object|null>} Job record or null if not found
   */
  async findByTaskId(taskId) {
    try {
      const query = 'SELECT * FROM task_jobs WHERE task_id = ?';
      const [rows] = await pool.execute(query, [taskId]);

      if (rows.length === 0) {
        return null;
      }

      return rows[0];

    } catch (error) {
      logger.error('Database error in TaskJobRepository.findByTaskId', {
        error: error.message,
        code: error.code,
        taskId
      });

      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Updates job status
   * @param {number} id - Internal job ID
   * @param {Object} updateData - Fields to update
   * @returns {Promise<Object>} Updated job record
   */
  async updateStatus(id, updateData) {
    try {
      const keys = Object.keys(updateData);
      const values = Object.values(updateData);

      if (keys.length === 0) {
        throw new Error('No fields to update');
      }

      const setClause = keys.map(key => `${key} = ?`).join(', ');
      const query = `UPDATE task_jobs SET ${setClause} WHERE id = ?`;

      const [result] = await pool.execute(query, [...values, id]);

      if (result.affectedRows === 0) {
        throw new Error('Job not found');
      }

      return this.findById(id);

    } catch (error) {
      logger.error('Database error in TaskJobRepository.updateStatus', {
        error: error.message,
        code: error.code,
        id,
        updateData
      });

      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Finds all jobs with optional filters
   * @param {Object} filters - Optional filters
   * @param {number} filters.limit - Maximum number of results
   * @param {number} filters.offset - Number of results to skip
   * @param {string} filters.status - Filter by status
   * @param {number} filters.task_id - Filter by task_id
   * @returns {Promise<Array>} Array of job records
   */
  async findAll(filters = {}) {
    try {
      let query = 'SELECT * FROM task_jobs WHERE 1=1';
      const values = [];

      if (filters.status) {
        query += ' AND status = ?';
        values.push(filters.status);
      }

      if (filters.task_id) {
        query += ' AND task_id = ?';
        values.push(filters.task_id);
      }

      query += ' ORDER BY created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
        values.push(filters.limit);

        if (filters.offset) {
          query += ' OFFSET ?';
          values.push(filters.offset);
        }
      }

      const [rows] = await pool.execute(query, values);

      return rows;

    } catch (error) {
      logger.error('Database error in TaskJobRepository.findAll', {
        error: error.message,
        code: error.code,
        filters
      });

      throw new Error(`Database error: ${error.message}`);
    }
  }
}

module.exports = new TaskJobRepository();
