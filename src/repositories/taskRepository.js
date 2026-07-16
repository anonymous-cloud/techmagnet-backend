const { pool } = require('../config/db');
const logger = require('../utils/logger');
const { ValidationError } = require('../errors');

class TaskRepository {
  /**
   * Creates a new task in the database
   * @param {Object} taskData - Task data to insert
   * @returns {Promise<Object>} Created task record with inserted ID
   */
  async create(taskData) {
    if (!taskData || typeof taskData !== 'object') {
      throw new ValidationError('taskData must be a valid object');
    }
    if (!taskData.keyword || typeof taskData.keyword !== 'string' || !taskData.keyword.trim()) {
      throw new ValidationError('taskData.keyword is required and must be a non-empty string');
    }

    try {
      const query = `
        INSERT INTO tasks (
          task_id, status_code, status_message, cost, execution_time,
          keyword, location_code, language_code, priority, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        taskData.task_id || null,
        taskData.status_code || 0,
        taskData.status_message || 'PENDING',
        taskData.cost || 0.0000,
        taskData.execution_time || 0.0000,
        taskData.keyword,
        taskData.location_code,
        taskData.language_code,
        taskData.priority || 1,
        taskData.created_by || 'system'
      ];

      const [result] = await pool.execute(query, values);
      return { id: result.insertId, ...taskData };
    } catch (error) {
      logger.error('Database error in TaskRepository.create', { error: error.message, taskData });
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Creates multiple tasks in bulk
   * @param {Array<Object>} tasksArray - Array of task data objects
   * @returns {Promise<Array<Object>>} Inserted task objects with their generated IDs
   */
  async createBulk(tasksArray) {
    if (!Array.isArray(tasksArray)) {
      throw new ValidationError('tasksArray must be a valid array');
    }
    if (tasksArray.length === 0) return [];

    // Validate elements
    tasksArray.forEach((task, idx) => {
      if (!task || typeof task !== 'object') {
        throw new ValidationError(`Task at index ${idx} must be a valid object`);
      }
      if (!task.keyword || typeof task.keyword !== 'string' || !task.keyword.trim()) {
        throw new ValidationError(`Task at index ${idx} is missing keyword`);
      }
    });

    try {
      const query = `
        INSERT INTO tasks (
          task_id, status_code, status_message, cost, execution_time,
          keyword, location_code, language_code, priority, created_by
        ) VALUES ?
      `;

      const values = tasksArray.map(task => [
        task.task_id || null,
        task.status_code || 0,
        task.status_message || 'PENDING',
        task.cost || 0.0000,
        task.execution_time || 0.0000,
        task.keyword,
        task.location_code,
        task.language_code,
        task.priority || 1,
        task.created_by || 'system'
      ]);

      // mysql2 bulk insert uses query instead of execute
      const [result] = await pool.query(query, [values]);
      
      const startId = result.insertId;
      if (startId === undefined || startId === null || isNaN(startId) || startId === 0) {
        throw new Error('Database error: Bulk insert did not return a valid start auto-increment ID');
      }

      return tasksArray.map((task, index) => ({
        id: startId + index,
        ...task
      }));
    } catch (error) {
      logger.error('Database error in TaskRepository.createBulk', { error: error.message });
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Builds SQL WHERE conditions and values dynamically from filters
   * @param {Object} filters - Search filters
   * @returns {Object} { whereClause, values }
   */
  _buildQueryConditions(filters) {
    const whereClauses = [];
    const values = [];

    if (filters.keyword) {
      whereClauses.push('keyword LIKE ?');
      values.push(`%${filters.keyword}%`);
    }

    if (filters.status_code !== undefined && filters.status_code !== null) {
      whereClauses.push('status_code = ?');
      values.push(parseInt(filters.status_code, 10));
    }

    if (filters.status_message) {
      whereClauses.push('status_message = ?');
      values.push(filters.status_message);
    }

    if (filters.priority !== undefined && filters.priority !== null) {
      whereClauses.push('priority = ?');
      values.push(parseInt(filters.priority, 10));
    }

    if (filters.language_code) {
      whereClauses.push('language_code = ?');
      values.push(filters.language_code);
    }

    if (filters.location_code !== undefined && filters.location_code !== null) {
      whereClauses.push('location_code = ?');
      values.push(parseInt(filters.location_code, 10));
    }

    if (filters.created_by) {
      whereClauses.push('created_by = ?');
      values.push(filters.created_by);
    }

    if (filters.startDate) {
      whereClauses.push('created_at >= ?');
      values.push(new Date(filters.startDate));
    }

    if (filters.endDate) {
      whereClauses.push('created_at <= ?');
      const date = new Date(filters.endDate);
      if (String(filters.endDate).length <= 10) {
        date.setHours(23, 59, 59, 999);
      }
      values.push(date);
    }

    const whereClause = whereClauses.length > 0 ? ' WHERE ' + whereClauses.join(' AND ') : '';
    return { whereClause, values };
  }

  /**
   * Finds tasks matching filters
   * @param {Object} filters - Search filters
   * @returns {Promise<Array>} List of tasks
   */
  async findAll(filters = {}) {
    if (!filters || typeof filters !== 'object') {
      throw new ValidationError('filters must be a valid object');
    }

    try {
      const { whereClause, values } = this._buildQueryConditions(filters);
      let query = `SELECT * FROM tasks${whereClause}`;

      // Sorting
      const approvedSortColumns = [
        'id', 'keyword', 'language_code', 'location_code', 'priority',
        'status_code', 'status_message', 'cost', 'created_at'
      ];
      const sortBy = approvedSortColumns.includes(filters.sortBy) ? filters.sortBy : 'created_at';
      const sortOrder = (String(filters.sortOrder || 'DESC').toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
      query += ` ORDER BY ${sortBy} ${sortOrder}`;

      // Pagination
      if (filters.limit !== undefined && filters.limit !== null) {
        const limitVal = parseInt(filters.limit, 10);
        if (!isNaN(limitVal)) {
          query += ' LIMIT ?';
          values.push(limitVal);

          if (filters.offset !== undefined && filters.offset !== null) {
            const offsetVal = parseInt(filters.offset, 10);
            if (!isNaN(offsetVal)) {
              query += ' OFFSET ?';
              values.push(offsetVal);
            }
          }
        }
      }

      const [rows] = await pool.query(query, values);
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

  /**
   * Counts tasks matching filters
   * @param {Object} filters - Search filters
   * @returns {Promise<number>} Total count of matching tasks
   */
  async countAll(filters = {}) {
    if (!filters || typeof filters !== 'object') {
      throw new ValidationError('filters must be a valid object');
    }

    try {
      const { whereClause, values } = this._buildQueryConditions(filters);
      const query = `SELECT COUNT(*) as count FROM tasks${whereClause}`;

      const [rows] = await pool.query(query, values);
      return rows[0].count;
    } catch (error) {
      logger.error('Database error in TaskRepository.countAll', {
        error: error.message,
        code: error.code,
        filters
      });
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Find a task by id
   * @param {number} id - Task primary key ID
   * @returns {Promise<Object|null>} Task object or null
   */
  async findById(id) {
    if (id === undefined || id === null || isNaN(Number(id))) {
      throw new ValidationError(`id must be a valid number, received: ${id}`);
    }

    try {
      const query = 'SELECT * FROM tasks WHERE id = ?';
      const [rows] = await pool.execute(query, [id]);
      return rows.length > 0 ? rows[0] : null;
    } catch (error) {
      logger.error('Database error in TaskRepository.findById', { error: error.message, id });
      throw new Error(`Database error: ${error.message}`);
    }
  }

  /**
   * Updates task status and API metrics
   * @param {number} id - Task PK
   * @param {Object} updateData - Data to update
   */
  async update(id, updateData) {
    if (id === undefined || id === null || isNaN(Number(id))) {
      throw new ValidationError(`id must be a valid number, received: ${id}`);
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

      const query = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`;
      values.push(id);

      await pool.execute(query, values);
    } catch (error) {
      logger.error('Database error in TaskRepository.update', { error: error.message, id, updateData });
      throw new Error(`Database error: ${error.message}`);
    }
  }
}

module.exports = new TaskRepository();

