const taskRepository = require('../repositories/taskRepository');
const taskJobRepository = require('../repositories/taskJobRepository');
const { taskQueue } = require('../config/queue');
const logger = require('../utils/logger');

class TaskService {
  /**
   * Helper to check for a deterministic duplicate task
   */
  async checkDuplicate(keyword, language_code, location_code) {
    try {
      const filters = { keyword };
      const tasks = await taskRepository.findAll(filters);
      
      // Filter exactly by language and location
      const duplicate = tasks.find(t => 
        t.keyword.toLowerCase() === keyword.toLowerCase() &&
        t.language_code === language_code &&
        parseInt(t.location_code, 10) === parseInt(location_code, 10)
      );
      
      return duplicate || null;
    } catch (error) {
      logger.error('Error checking duplicate task', { error: error.message });
      return null;
    }
  }

  /**
   * Creates a single task in pending state and enqueues a processing job
   */
  async createPendingTask(taskData) {
    // 1. Check for deterministic duplicate
    const duplicate = await this.checkDuplicate(
      taskData.keyword,
      taskData.language_code || taskData.language,
      taskData.location_code || taskData.location
    );

    if (duplicate) {
      logger.info('Deterministic duplicate found; returning existing task', {
        taskId: duplicate.id,
        keyword: duplicate.keyword
      });
      return { id: duplicate.id, ...duplicate, isDuplicate: true };
    }

    // 2. Create task record
    const task = await taskRepository.create({
      keyword: taskData.keyword,
      language_code: taskData.language_code || taskData.language,
      location_code: parseInt(taskData.location_code || taskData.location, 10),
      priority: parseInt(taskData.priority || 1, 10),
      status_code: 0,
      status_message: 'PENDING',
      cost: 0.0000,
      execution_time: 0.0000,
      created_by: taskData.created_by || 'system'
    });

    if (task.id === undefined || task.id === null || isNaN(task.id)) {
      throw new Error(`Database error: Created task record returned invalid id: ${task.id}`);
    }

    // 3. Add to BullMQ
    const job = await taskQueue.add('processTask', { taskId: task.id }, { priority: task.priority === 2 ? 1 : 10 });
    logger.info('Job waiting in queue', { jobId: job.id });

    // 4. Create task_jobs record
    await taskJobRepository.create({
      task_id: task.id,
      job_id: job.id,
      status: 'PENDING',
      attempts: 0
    });

    return task;
  }

  /**
   * Processes a batch of valid CSV rows (up to 100)
   * Creates task records, enqueues ONE job, and maps task_jobs
   */
  async createBulkTasks(batchRows) {
    const tasksToInsert = [];
    const duplicates = [];

    // 1. Check duplicates for each row
    for (const row of batchRows) {
      const duplicate = await this.checkDuplicate(
        row.keyword,
        row.language_code,
        row.location_code
      );

      if (duplicate) {
        duplicates.push(duplicate);
      } else {
        tasksToInsert.push(row);
      }
    }

    if (tasksToInsert.length === 0) {
      logger.info('All tasks in batch were duplicates');
      return { createdTasks: [], duplicates };
    }

    // 2. Create all task records in bulk
    const insertedTasks = await taskRepository.createBulk(tasksToInsert);
    logger.info(`Inserted ${insertedTasks.length} tasks in database`);

    // 3. Create ONE BullMQ job for this batch
    // High priority batch runs first
    const maxPriority = Math.max(...insertedTasks.map(t => t.priority || 1));
    const jobPayload = {
      type: 'BULK_TASK_BATCH',
      tasks: insertedTasks.map(t => ({
        id: t.id,
        keyword: t.keyword,
        language_code: t.language_code,
        location_code: t.location_code,
        priority: t.priority
      }))
    };

    // Validate that all tasks have valid auto-increment IDs
    jobPayload.tasks.forEach((t, idx) => {
      if (t.id === undefined || t.id === null || isNaN(t.id)) {
        throw new Error(`Database error: Task at index ${idx} in bulk batch has invalid id: ${t.id}`);
      }
    });

    const job = await taskQueue.add(
      'processTaskBatch',
      jobPayload,
      { priority: maxPriority === 2 ? 1 : 10 }
    );
    logger.info('Bulk batch job waiting in queue', { jobId: job.id, size: insertedTasks.length });

    // 4. Create task_jobs records for all tasks in the batch
    const jobRecords = insertedTasks.map(task => ({
      task_id: task.id,
      job_id: job.id,
      status: 'PENDING',
      attempts: 0
    }));

    await taskJobRepository.createBulk(jobRecords);

    return {
      createdTasks: insertedTasks,
      duplicates
    };
  }

  /**
   * Retrieves tasks with pagination and filters
   * @param {Object} queryFilters - Filter and pagination options from controller
   * @returns {Promise<Object>} Object containing tasks list, pagination metadata, applied filters, and sorting information
   */
  async getTasks(queryFilters = {}) {
    const page = queryFilters.page !== undefined ? parseInt(queryFilters.page, 10) : 1;
    const limit = queryFilters.limit !== undefined ? parseInt(queryFilters.limit, 10) : 10;
    const offset = queryFilters.offset !== undefined ? parseInt(queryFilters.offset, 10) : (page - 1) * limit;

    const repositoryFilters = {
      ...queryFilters,
      limit,
      offset
    };

    // 1. Get total records count for these filters
    const totalRecords = await taskRepository.countAll(repositoryFilters);

    // 2. Fetch the records list matching filters and pagination limits
    const tasks = await taskRepository.findAll(repositoryFilters);

    // 3. Calculate page metadata
    const totalPages = limit > 0 ? Math.ceil(totalRecords / limit) : 0;
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      tasks,
      pagination: {
        totalRecords,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage,
        hasPreviousPage
      },
      filters: {
        keyword: queryFilters.keyword || null,
        status_code: queryFilters.status_code !== undefined ? parseInt(queryFilters.status_code, 10) : null,
        status_message: queryFilters.status_message || null,
        priority: queryFilters.priority !== undefined ? parseInt(queryFilters.priority, 10) : null,
        language_code: queryFilters.language_code || null,
        location_code: queryFilters.location_code !== undefined ? parseInt(queryFilters.location_code, 10) : null,
        created_by: queryFilters.created_by || null,
        startDate: queryFilters.startDate || null,
        endDate: queryFilters.endDate || null
      },
      sorting: {
        sortBy: queryFilters.sortBy || 'created_at',
        sortOrder: queryFilters.sortOrder || 'DESC'
      }
    };
  }
}

module.exports = new TaskService();
