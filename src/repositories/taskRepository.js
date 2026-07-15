const { pool } = require('../config/db');
const logger = require('../utils/logger');

class TaskRepository {
  /**
   * Creates a new task in the database
   * @param {Object} taskData - Task data to insert
   * @param {string} taskData.task_id - External task ID from DataForSEO
   * @param {number} taskData.status_code - HTTP status code
   * @param {string} taskData.status_message - Status message
   * @param {number} taskData.cost - Cost of the request
   * @param {number} taskData.execution_time - Execution time in seconds
   * @param {string} taskData.keyword - Search keyword
   * @param {number} taskData.location_code - Location code
   * @param {string} taskData.language_code - Language code
   * @param {number} taskData.priority - Priority (1 or 2)
   * @param {string} taskData.created_by - User who created the task
   * @returns {Promise<Object>} Created task record
   */
  async create(taskData) {
    try {
      const query = `
        INSERT INTO tasks (
          task_id, status_code, status_message, cost, execution_time,
          keyword, location_code, language_code, priority, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        taskData.task_id,
        taskData.status_code,
        taskData.status_message,
        taskData.cost,
        taskData.execution_time,
        taskData.keyword,
        taskData.location_code,
        taskData.language_code,
        taskData.priority,
        taskData.created_by || 'system'
      ];

      logger.info('Repository: Executing INSERT', {
        taskData: { ...taskData, created_by: undefined },
        values: values.map((v, i) => `${i}: ${typeof v} = ${v}`)
      });

      const [result] = await pool.execute(query, values);

      // Return the created task
      return this.findById(result.insertId);

    } catch (error) {
      logger.error('Database error in TaskRepository.create', {
        error: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        taskData: { ...taskData, created_by: undefined }
      });

      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Finds a task by internal ID
   * @param {number} id - Internal task ID
   * @returns {Promise<Object|null>} Task record or null if not found
   */
  async findById(id) {
    try {
      const query = 'SELECT * FROM tasks WHERE id = ?';
      const [rows] = await pool.execute(query, [id]);

      if (rows.length === 0) {
        return null;
      }

      return rows[0];

    } catch (error) {
      logger.error('Database error in TaskRepository.findById', {
        error: error.message,
        code: error.code,
        id
      });

      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Finds a task by external task_id
   * @param {string} taskId - External task ID from DataForSEO
   * @returns {Promise<Object|null>} Task record or null if not found
   */
  async findByTaskId(taskId) {
    try {
      const query = 'SELECT * FROM tasks WHERE task_id = ?';
      const [rows] = await pool.execute(query, [taskId]);

      if (rows.length === 0) {
        return null;
      }

      return rows[0];

    } catch (error) {
      logger.error('Database error in TaskRepository.findByTaskId', {
        error: error.message,
        code: error.code,
        taskId
      });

      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Updates a task record with provided fields
   * @param {number} id - Internal task ID
   * @param {Object} updateData - Key/value pairs to update
   * @returns {Promise<Object>} Updated task record
   */
  async update(id, updateData) {
    try {
      const keys = Object.keys(updateData);
      const values = Object.values(updateData);

      if (keys.length === 0) {
        throw new Error('No fields to update');
      }

      const setClause = keys.map(key => `${key} = ?`).join(', ');
      const query = `UPDATE tasks SET ${setClause} WHERE id = ?`;

      const [result] = await pool.execute(query, [...values, id]);

      if (result.affectedRows === 0) {
        throw new Error('Task not found');
      }

      return this.findById(id);

    } catch (error) {
      logger.error('Database error in TaskRepository.update', {
        error: error.message,
        code: error.code,
        id,
        updateData
      });

      throw new Error(`Database error: ${error.message}`);
    }
  }

  /** 
   * Deletes a task by internal ID
   * @param {number} id - Internal task ID
   * @returns {Promise<void>}
   */
  async deleteById(id) {
    try {
      const query = 'DELETE FROM tasks WHERE id = ?';
      const [result] = await pool.execute(query, [id]);

      if (result.affectedRows === 0) {
        throw new Error('Task not found');
      }

      return;

    } catch (error) {
      logger.error('Database error in TaskRepository.deleteById', {
        error: error.message,
        code: error.code,
        id
      });

      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Finds all tasks with optional filters
   * NOTE: Intentionally added for Module 3 (Dashboard) which requires
   * listing tasks with pagination and filtering capabilities
   * @param {Object} filters - Optional filters
   * @param {number} filters.limit - Maximum number of results
   * @param {number} filters.offset - Number of results to skip
   * @param {string} filters.keyword - Filter by keyword
   * @param {number} filters.status_code - Filter by status code
   * @param {string} filters.created_by - Filter by creator
   * @returns {Promise<Array>} Array of task records
   */
  async findAll(filters = {}) {
    try {
      let query = 'SELECT * FROM tasks WHERE 1=1';
      const values = [];

      if (filters.keyword) {
        query += ' AND keyword LIKE ?';
        values.push(`%${filters.keyword}%`);
      }

      if (filters.status_code) {
        query += ' AND status_code = ?';
        values.push(filters.status_code);
      }

      if (filters.created_by) {
        query += ' AND created_by = ?';
        values.push(filters.created_by);
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
      logger.error('Database error in TaskRepository.findAll', {
        error: error.message,
        code: error.code,
        filters
      });

      throw new Error(`Database error: ${error.message}`);
    }
  }
}

module.exports = new TaskRepository();
