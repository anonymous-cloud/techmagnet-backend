const logger = require('../utils/logger');
const { fetchSERPData } = require('./dataForSeoService');
const taskRepository = require('../repositories/taskRepository');
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
async function createTask(taskInput) {
  const { keyword, language, location, priority } = taskInput;

  try {
    logger.info('Task creation started', { keyword });

    // Step 1: Call DataForSEO API
    const apiResponse = await fetchSERPData(keyword, location, language, priority);

    // Step 2: Check if API call was successful
    if (!apiResponse.success) {
      logger.warn('DataForSEO request failed', { 
        errorCode: apiResponse.error.code,
        keyword 
      });
      throw new ExternalApiError(apiResponse.error.message);
    }

    logger.info('DataForSEO request completed', { keyword });

    // Step 3: Check for duplicates (using task_id from API response)
    await checkDuplicate(apiResponse.data.task_id);

    // Step 4: Map API response to database model
    const taskData = mapTaskData(apiResponse.data);

    // Step 5: Save to database
    const createdTask = await saveTask(taskData);

    logger.info('Task saved successfully', { 
      taskId: createdTask.task_id,
      keyword 
    });

    // Step 6: Return business object
    return toBusinessObject(createdTask);

  } catch (error) {
    logger.error('Task creation failed', { 
      error: error.message,
      keyword 
    });

    // Re-throw known errors
    if (error instanceof DuplicateTaskError || 
        error instanceof ExternalApiError || 
        error instanceof DatabaseError) {
      throw error;
    }

    // Wrap unknown errors
    throw new DatabaseError('Task creation failed');
  }
}

module.exports = { createTask };
