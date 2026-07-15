const { Queue } = require('bullmq');
const redis = require('../config/redis');
const logger = require('../utils/logger');

/**
 * BullMQ Queue Configuration
 * Creates and configures the task processing queue
 */

const QUEUE_NAME = 'dataforseo-task-queue';

const taskQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      count: 1000, // Keep last 1000 completed jobs
      age: 24 * 3600 // Max 24 hours
    },
    removeOnFail: {
      count: 5000, // Keep last 5000 failed jobs
      age: 7 * 24 * 3600 // Max 7 days
    }
  }
});

taskQueue.on('error', (error) => {
  logger.error('Queue error', { error: error.message });
});

taskQueue.on('waiting', (job) => {
  logger.info('Job waiting in queue', { jobId: job.id });
});

taskQueue.on('active', (job) => {
  logger.info('Job started processing', { jobId: job.id });
});

taskQueue.on('completed', (job) => {
  logger.info('Job completed successfully', { jobId: job.id });
});

taskQueue.on('failed', (job, error) => {
  logger.error('Job failed', { 
    jobId: job?.id, 
    error: error.message,
    attempts: job?.attemptsMade 
  });
});

module.exports = taskQueue;
