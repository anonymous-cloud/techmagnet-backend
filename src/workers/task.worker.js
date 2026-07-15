const { Worker } = require('bullmq');
const redis = require('../config/redis');
const logger = require('../utils/logger');
const { processJob } = require('../services/taskJobService');

/**
 * BullMQ Worker for task processing
 * Processes jobs from the dataforseo-task-queue
 */

const QUEUE_NAME = 'dataforseo-task-queue';

const worker = new Worker(QUEUE_NAME, async (job) => {
  logger.info('Worker received job', { 
    jobId: job.id, 
    taskId: job.data.taskId 
  });

  await processJob(job);

}, {
  connection: redis,
  concurrency: 5 // Process up to 5 jobs concurrently
});

worker.on('completed', (job) => {
  logger.info('Worker completed job', { 
    jobId: job.id,
    taskId: job.data.taskId 
  });
});

worker.on('failed', (job, error) => {
  logger.error('Worker failed job', { 
    jobId: job?.id,
    taskId: job?.data?.taskId,
    error: error.message 
  });
});

worker.on('error', (error) => {
  logger.error('Worker error', { error: error.message });
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down worker...');
  
  await worker.close();
  await redis.quit();
  
  logger.info('Worker shut down successfully');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logger.info('Worker started successfully', { queueName: QUEUE_NAME });
