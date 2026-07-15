const logger = require('../utils/logger');
const taskJobRepository = require('../repositories/taskJobRepository');
const taskRepository = require('../repositories/taskRepository');
const { fetchSERPData } = require('./dataForSeoService');
const { QueueError } = require('../errors/QueueError');

/**
 * Creates a new task job and adds it to the queue
 * @param {Object} jobData - Job data
 * @param {number} jobData.task_id - Foreign key to tasks.id
 * @param {string} jobData.job_id - BullMQ job ID
 * @returns {Promise<Object>} Created job record
 */
async function createJob(jobData) {
  try {
    logger.info('Creating task job', { taskId: jobData.task_id });

    const job = await taskJobRepository.create(jobData);

    logger.info('Task job created successfully', { 
      jobId: job.id,
      taskId: job.task_id 
    });

    return job;

  } catch (error) {
    logger.error('Task job creation failed', {
      error: error.message,
      taskId: jobData.task_id
    });

    throw new QueueError('Failed to create task job');
  }
}

/**
 * Updates job status to PROCESSING
 * @param {number} jobRecordId - Internal job record ID
 * @returns {Promise<Object>} Updated job record
 */
async function markAsProcessing(jobRecordId) {
  try {
    logger.info('Marking job as processing', { jobRecordId });

    return await taskJobRepository.updateStatus(jobRecordId, {
      status: 'PROCESSING',
      started_at: new Date()
    });

  } catch (error) {
    logger.error('Failed to mark job as processing', {
      error: error.message,
      jobRecordId
    });

    throw new QueueError('Failed to update job status');
  }
}

/**
 * Processes a job - calls DataForSEO and updates results
 * @param {Object} job - BullMQ job object
 * @returns {Promise<void>}
 */
async function processJob(job) {
  const { taskId } = job.data;
  let jobRecordId = null;

  try {
    // Find the job record
    const jobRecord = await taskJobRepository.findByJobId(job.id);
    if (!jobRecord) {
      throw new Error('Job record not found');
    }
    jobRecordId = jobRecord.id;

    // Find the task record
    const task = await taskRepository.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Mark as processing
    await markAsProcessing(jobRecordId);

    logger.info('Calling DataForSEO API', { 
      taskId,
      keyword: task.keyword 
    });

    // Call DataForSEO API
    const apiResponse = await fetchSERPData(
      task.keyword,
      task.location_code,
      task.language_code,
      task.priority
    );

    if (!apiResponse.success) {
      throw new Error(apiResponse.error.message);
    }

    logger.info('DataForSEO API call successful', { taskId });

    // Parse execution_time and cost from API response
    let executionTime = apiResponse.data.execution_time;
    if (typeof executionTime === 'string') {
      executionTime = parseFloat(executionTime.replace(' sec.', '').trim());
    }

    const cost = typeof apiResponse.data.cost === 'string' 
      ? parseFloat(apiResponse.data.cost) 
      : apiResponse.data.cost;

    // Update task with DataForSEO results
    await taskRepository.update(taskId, {
      task_id: apiResponse.data.task_id,
      status_code: apiResponse.data.status_code,
      status_message: apiResponse.data.status_message,
      cost: cost,
      execution_time: executionTime
    });

    // Mark job as completed
    await taskJobRepository.updateStatus(jobRecordId, {
      status: 'COMPLETED',
      completed_at: new Date()
    });

    logger.info('Job completed successfully', { 
      jobRecordId,
      taskId 
    });

  } catch (error) {
    logger.error('Job processing failed', {
      error: error.message,
      jobRecordId,
      taskId
    });

    // Mark job as failed
    if (jobRecordId) {
      await taskJobRepository.updateStatus(jobRecordId, {
        status: 'FAILED',
        failed_at: new Date(),
        error_message: error.message,
        attempts: job.attemptsMade
      });
    }

    throw error;
  }
}

module.exports = {
  createJob,
  markAsProcessing,
  processJob
};
