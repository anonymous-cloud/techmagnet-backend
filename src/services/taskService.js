const logger = require('../utils/logger');
const { fetchSERPData } = require('./dataForSeoService');
const taskRepository = require('../repositories/taskRepository');
const taskJobRepository = require('../repositories/taskJobRepository');
const taskQueue = require('../queues/task.queue');
const redis = require('../config/redis');
const { DuplicateTaskError, ExternalApiError, DatabaseError } = require('../errors');

/**
 * Checks if a task already exists by task_id
 * @param {string} taskId - External task ID from DataForSEO
 * @returns {Promise<void>} Throws DuplicateTaskError if task exists
 */
async function checkDuplicate(taskId) {
  const existingTask = await taskRepository.findByTaskId(taskId);

  if (existingTask) {
    logger.warn('Duplicate task detected', { taskId });
    throw new DuplicateTaskError();
  }
}

/**
 * Maps DataForSEO API response to database model
 * @param {Object} apiData - Data from DataForSEO API
 * @param {string} createdBy - User who created the task
 * @returns {Object} Mapped task data ready for database
 */
function mapTaskData(apiData, createdBy = 'system') {
  // Parse execution_time: DataForSEO returns "3.4338 sec." but we need numeric value
  let executionTime = apiData.execution_time;
  if (typeof executionTime === 'string') {
    // Remove " sec." suffix and convert to number
    executionTime = parseFloat(executionTime.replace(' sec.', '').trim());
  }

  // Ensure cost is also a number
  const cost = typeof apiData.cost === 'string' ? parseFloat(apiData.cost) : apiData.cost;

  return {
    task_id: apiData.task_id,
    status_code: apiData.status_code,
    status_message: apiData.status_message,
    cost: cost,
    execution_time: executionTime,
    keyword: apiData.keyword,
    location_code: apiData.location_code,
    language_code: apiData.language_code,
    priority: apiData.priority,
    created_by: createdBy
  };
}

/**
 * Saves task to database
 * @param {Object} taskData - Task data to save
 * @returns {Promise<Object>} Created task record
 */
async function saveTask(taskData) {
  try {
    return await taskRepository.create(taskData);
  } catch (error) {
    // Handle race condition: duplicate-key error from database
    if (error.message.includes('Duplicate entry')) {
      logger.warn('Duplicate task detected (race condition)', { taskId: taskData.task_id });
      throw new DuplicateTaskError();
    }

    logger.error('Database error during task save', { error: error.message });
    throw new DatabaseError('Failed to save task to database');
  }
}

async function createPendingTask(taskInput) {
  const taskData = {
    task_id: null,
    status_code: 0,
    status_message: 'PENDING',
    cost: 0.0000,
    execution_time: 0.0000,
    keyword: taskInput.keyword,
    location_code: taskInput.location,
    language_code: taskInput.language,
    priority: taskInput.priority,
    created_by: taskInput.created_by || 'system'
  };

  const createdTask = await saveTask(taskData);

  let job;
  try {
    job = await taskQueue.add('processTask', { taskId: createdTask.id });
  } catch (err) {
    logger.error('Failed to enqueue job; rolling back created task', { error: err.message, taskId: createdTask.id });
    try {
      await taskRepository.deleteById(createdTask.id);
    } catch (delErr) {
      logger.error('Failed to rollback task after queue.add failure', { error: delErr.message, taskId: createdTask.id });
    }
    throw new Error('Failed to enqueue processing job');
  }

  try {
    await taskJobRepository.create({
      task_id: createdTask.id,
      job_id: job.id,
      status: 'PENDING'
    });
  } catch (err) {
    logger.error('Failed to create task_jobs record; removing job and rolling back task', { error: err.message, jobId: job.id, taskId: createdTask.id });
    try {
      await taskQueue.remove(job.id);
    } catch (removeErr) {
      logger.error('Failed to remove job after task_jobs failure', { error: removeErr.message, jobId: job.id });
    }
    try {
      await taskRepository.deleteById(createdTask.id);
    } catch (delErr) {
      logger.error('Failed to rollback task after task_jobs create failure', { error: delErr.message, taskId: createdTask.id });
    }
    throw new Error('Failed to persist job metadata');
  }

  return createdTask;
}

async function createBulkTasks(batchRows) {
  const createdTasks = [];

  for (const row of batchRows) {
    const taskData = {
      task_id: null,
      status_code: 0,
      status_message: 'PENDING',
      cost: 0.0000,
      execution_time: 0.0000,
      keyword: row.keyword,
      location_code: row.location,
      language_code: row.language,
      priority: row.priority,
      created_by: 'system'
    };

    const createdTask = await saveTask(taskData);
    createdTasks.push(createdTask);
  }

  const jobPayload = {
    type: 'BULK_TASK_BATCH',
    tasks: createdTasks.map((task) => ({
      taskId: task.id,
      keyword: task.keyword,
      language_code: task.language_code,
      location_code: task.location_code,
      priority: task.priority
    }))
  };

  const job = await taskQueue.add('processTaskBatch', jobPayload);

  await Promise.all(createdTasks.map((task) =>
    taskJobRepository.create({
      task_id: task.id,
      job_id: job.id,
      status: 'PENDING'
    })
  ));

  return job;
}

/**
 * Transforms database record to business object
 * @param {Object} dbRecord - Raw database record
 * @returns {Object} Business object
 */
function toBusinessObject(dbRecord) {
  return {
    taskId: dbRecord.task_id,
    keyword: dbRecord.keyword,
    // status: dbRecord.status_code === 200 ? 'success' : 'failed',
    status: dbRecord.status_code >= 20000 && dbRecord.status_code < 30000? 'success': 'failed',
    cost: dbRecord.cost,
    executionTime: dbRecord.execution_time,
    createdAt: dbRecord.created_at
  };
}

/**
 * Creates a new task by calling DataForSEO API and storing the result
 * @param {Object} taskInput - Validated task input
 * @param {string} taskInput.keyword - Search keyword
 * @param {string} taskInput.language - Language code
 * @param {number} taskInput.location - Location code
 * @param {number} taskInput.priority - Priority (1 or 2)
 * @returns {Promise<Object>} Business object representing created task
 */
async function createTask(taskInput, idempotencyKey) {
  const { keyword, language, location, priority } = taskInput;

  try {
    logger.info('Task creation started', { keyword });

    // 1) Idempotency-Key lookup (Redis)
    if (idempotencyKey) {
      try {
        const redisKey = `idempotency:${idempotencyKey}`;
        const existingTaskId = await redis.get(redisKey);
        if (existingTaskId) {
          const existing = await taskRepository.findById(Number(existingTaskId));
          if (existing) {
            logger.info('Idempotency key matched existing task', { taskId: existing.id });
            return toBusinessObject(existing);
          }
        }
      } catch (err) {
        logger.warn('Idempotency Redis lookup failed, continuing', { error: err.message });
      }
    }

    // 2) Deterministic duplicate check (keyword, language, location, priority)
    const candidates = await taskRepository.findAll({ keyword });
    const duplicate = candidates.find(t =>
      t.language_code === language &&
      Number(t.location_code) === Number(location) &&
      Number(t.priority) === Number(priority)
    );

    if (duplicate) {
      // If there is a task_jobs record check its status
      try {
        const jobRecord = await taskJobRepository.findByTaskId(duplicate.id);
        const jobStatus = jobRecord ? jobRecord.status : null;

        if (!jobStatus || ['PENDING', 'PROCESSING', 'COMPLETED'].includes(jobStatus)) {
          logger.info('Deterministic duplicate found; returning existing task', { taskId: duplicate.id, jobStatus });
          return toBusinessObject(duplicate);
        }
        // if jobStatus === 'FAILED' continue to create new task
      } catch (err) {
        logger.warn('Failed to read task_jobs for duplicate check; returning existing task as safe default', { error: err.message, taskId: duplicate.id });
        return toBusinessObject(duplicate);
      }
    }

    // 3) Create tasks record with required initial values
    const taskData = {
      task_id: null,
      status_code: 0,
      status_message: 'PENDING',
      cost: 0.0000,
      execution_time: 0.0000,
      keyword: keyword,
      location_code: location,
      language_code: language,
      priority: priority,
      created_by: 'system'
    };

    const createdTask = await taskRepository.create(taskData);

    // 4) Enqueue job with BullMQ
    let job;
    try {
      job = await taskQueue.add('processTask', { taskId: createdTask.id });
    } catch (err) {
      logger.error('Failed to enqueue job; rolling back created task', { error: err.message, taskId: createdTask.id });
      try {
        await taskRepository.deleteById(createdTask.id);
      } catch (delErr) {
        logger.error('Failed to rollback task after queue.add failure', { error: delErr.message, taskId: createdTask.id });
      }
      throw new Error('Failed to enqueue processing job');
    }

    // 5) Persist task_jobs record
    try {
      await taskJobRepository.create({
        task_id: createdTask.id,
        job_id: job.id,
        status: 'PENDING'
      });
    } catch (err) {
      logger.error('Failed to create task_jobs record; removing job and rolling back task', { error: err.message, jobId: job.id, taskId: createdTask.id });
      try {
        await taskQueue.remove(job.id);
      } catch (removeErr) {
        logger.error('Failed to remove job after task_jobs failure', { error: removeErr.message, jobId: job.id });
      }
      try {
        await taskRepository.deleteById(createdTask.id);
      } catch (delErr) {
        logger.error('Failed to rollback task after task_jobs create failure', { error: delErr.message, taskId: createdTask.id });
      }
      throw new Error('Failed to persist job metadata');
    }

    // 6) Save Idempotency-Key mapping in Redis (if provided)
    if (idempotencyKey) {
      try {
        const redisKey = `idempotency:${idempotencyKey}`;
        await redis.set(redisKey, String(createdTask.id), 'EX', 86400);
      } catch (err) {
        logger.warn('Failed to save idempotency mapping to Redis', { error: err.message, taskId: createdTask.id });
      }
    }

    // 7) Return business object (do not expose job id)
    return toBusinessObject(createdTask);

  } catch (error) {
    logger.error('Task creation failed', {
      error: error.message,
      keyword
    });

    if (error instanceof DuplicateTaskError ||
        error instanceof ExternalApiError ||
        error instanceof DatabaseError) {
      throw error;
    }

    throw new DatabaseError('Task creation failed');
  }
}

module.exports = { createTask, createPendingTask, createBulkTasks };
